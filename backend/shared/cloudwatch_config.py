"""
CloudWatch メトリクス・アラーム設定
要件6.4: CloudWatchメトリクス・アラーム設定
"""

import os
import json
import time
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from functools import wraps

logger = logging.getLogger(__name__)

# CloudWatch SDK の動的インポート
try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    CLOUDWATCH_AVAILABLE = True
except ImportError:
    logger.warning("Boto3 not available. CloudWatch features will be limited.")
    CLOUDWATCH_AVAILABLE = False

class CloudWatchConfig:
    """CloudWatch メトリクス・アラーム設定クラス"""
    
    def __init__(self):
        self.enabled = self._should_enable_cloudwatch()
        self.namespace = os.getenv('CLOUDWATCH_NAMESPACE', 'PhotoSharingApp')
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.region = os.getenv('AWS_REGION', 'ap-northeast-1')
        
        # メトリクス集計用のローカルストレージ
        self.local_metrics = {}
        self.metric_buffer = []
        self.buffer_size = int(os.getenv('CLOUDWATCH_BUFFER_SIZE', '20'))
        self.flush_interval = int(os.getenv('CLOUDWATCH_FLUSH_INTERVAL', '60'))  # seconds
        self.last_flush = time.time()
        
        if self.enabled and CLOUDWATCH_AVAILABLE:
            self._initialize_cloudwatch()
    
    def _should_enable_cloudwatch(self) -> bool:
        """CloudWatch を有効にするかどうかを判定"""
        return (
            os.getenv('ENVIRONMENT') in ['production', 'staging'] or
            os.getenv('ENABLE_CLOUDWATCH', '').lower() in ['true', '1', 'yes']
        )
    
    def _initialize_cloudwatch(self):
        """CloudWatch クライアントの初期化"""
        try:
            self.cloudwatch = boto3.client('cloudwatch', region_name=self.region)
            self.logs_client = boto3.client('logs', region_name=self.region)
            
            # 接続テスト
            self.cloudwatch.list_metrics(Namespace=self.namespace, MaxRecords=1)
            logger.info(f"CloudWatch initialized for namespace: {self.namespace}")
            
        except (ClientError, NoCredentialsError) as e:
            logger.warning(f"CloudWatch initialization failed: {e}")
            self.enabled = False
        except Exception as e:
            logger.error(f"Unexpected error initializing CloudWatch: {e}")
            self.enabled = False
    
    def put_metric(self, metric_name: str, value: float, unit: str = 'Count', 
                   dimensions: Dict[str, str] = None, timestamp: datetime = None):
        """メトリクスをCloudWatchに送信"""
        if not self.enabled:
            # 開発環境ではログに出力
            logger.info(f"Metric: {metric_name} = {value} {unit}", extra={
                'metric_name': metric_name,
                'metric_value': value,
                'metric_unit': unit,
                'dimensions': dimensions or {}
            })
            return
        
        try:
            metric_data = {
                'MetricName': metric_name,
                'Value': value,
                'Unit': unit,
                'Timestamp': timestamp or datetime.utcnow()
            }
            
            if dimensions:
                metric_data['Dimensions'] = [
                    {'Name': k, 'Value': v} for k, v in dimensions.items()
                ]
            
            # バッファに追加
            self.metric_buffer.append(metric_data)
            
            # バッファサイズまたは時間間隔でフラッシュ
            if (len(self.metric_buffer) >= self.buffer_size or 
                time.time() - self.last_flush >= self.flush_interval):
                self._flush_metrics()
                
        except Exception as e:
            logger.error(f"Failed to put metric {metric_name}: {e}")
    
    def _flush_metrics(self):
        """バッファされたメトリクスをCloudWatchに送信"""
        if not self.metric_buffer or not self.enabled:
            return
        
        try:
            # CloudWatch は一度に20個までのメトリクスを受け付ける
            batch_size = 20
            
            for i in range(0, len(self.metric_buffer), batch_size):
                batch = self.metric_buffer[i:i + batch_size]
                
                self.cloudwatch.put_metric_data(
                    Namespace=self.namespace,
                    MetricData=batch
                )
            
            logger.debug(f"Flushed {len(self.metric_buffer)} metrics to CloudWatch")
            self.metric_buffer.clear()
            self.last_flush = time.time()
            
        except Exception as e:
            logger.error(f"Failed to flush metrics to CloudWatch: {e}")
            # エラー時はバッファをクリアして無限蓄積を防ぐ
            self.metric_buffer.clear()
    
    def increment_counter(self, metric_name: str, value: int = 1, 
                         dimensions: Dict[str, str] = None):
        """カウンターメトリクスをインクリメント"""
        self.put_metric(metric_name, value, 'Count', dimensions)
    
    def record_timing(self, metric_name: str, duration_ms: float, 
                     dimensions: Dict[str, str] = None):
        """タイミングメトリクスを記録"""
        self.put_metric(metric_name, duration_ms, 'Milliseconds', dimensions)
    
    def record_gauge(self, metric_name: str, value: float, unit: str = 'None',
                    dimensions: Dict[str, str] = None):
        """ゲージメトリクスを記録"""
        self.put_metric(metric_name, value, unit, dimensions)
    
    def record_api_request(self, endpoint: str, method: str, status_code: int, 
                          duration_ms: float, user_id: str = None):
        """API リクエストメトリクスを記録"""
        dimensions = {
            'Endpoint': endpoint,
            'Method': method,
            'StatusCode': str(status_code),
            'Environment': self.environment
        }
        
        if user_id:
            dimensions['HasUser'] = 'true'
        else:
            dimensions['HasUser'] = 'false'
        
        # リクエスト数
        self.increment_counter('APIRequests', 1, dimensions)
        
        # レスポンス時間
        self.record_timing('APIResponseTime', duration_ms, dimensions)
        
        # エラー率計算用
        if status_code >= 400:
            self.increment_counter('APIErrors', 1, dimensions)
    
    def record_database_operation(self, operation: str, table_name: str, 
                                duration_ms: float, success: bool = True):
        """データベース操作メトリクスを記録"""
        dimensions = {
            'Operation': operation,
            'TableName': table_name,
            'Environment': self.environment
        }
        
        # 操作数
        self.increment_counter('DatabaseOperations', 1, dimensions)
        
        # 操作時間
        self.record_timing('DatabaseOperationTime', duration_ms, dimensions)
        
        # エラー率計算用
        if not success:
            self.increment_counter('DatabaseErrors', 1, dimensions)
    
    def record_user_activity(self, activity_type: str, user_id: str = None):
        """ユーザーアクティビティメトリクスを記録"""
        dimensions = {
            'ActivityType': activity_type,
            'Environment': self.environment
        }
        
        if user_id:
            dimensions['HasUser'] = 'true'
        
        self.increment_counter('UserActivity', 1, dimensions)
    
    def record_image_processing(self, operation: str, file_size_bytes: int, 
                              duration_ms: float, success: bool = True):
        """画像処理メトリクスを記録"""
        dimensions = {
            'Operation': operation,
            'Environment': self.environment
        }
        
        # 処理数
        self.increment_counter('ImageProcessing', 1, dimensions)
        
        # 処理時間
        self.record_timing('ImageProcessingTime', duration_ms, dimensions)
        
        # ファイルサイズ
        self.record_gauge('ImageFileSize', file_size_bytes, 'Bytes', dimensions)
        
        # エラー率計算用
        if not success:
            self.increment_counter('ImageProcessingErrors', 1, dimensions)
    
    def create_alarms(self) -> List[Dict[str, Any]]:
        """CloudWatch アラームの作成設定を返す"""
        if not self.enabled:
            return []
        
        alarms = [
            # API エラー率アラーム
            {
                'AlarmName': f'{self.namespace}-HighAPIErrorRate-{self.environment}',
                'AlarmDescription': 'API エラー率が高すぎます',
                'MetricName': 'APIErrors',
                'Namespace': self.namespace,
                'Statistic': 'Sum',
                'Period': 300,  # 5分
                'EvaluationPeriods': 2,
                'Threshold': 10.0,
                'ComparisonOperator': 'GreaterThanThreshold',
                'Dimensions': [
                    {'Name': 'Environment', 'Value': self.environment}
                ],
                'AlarmActions': [
                    f'arn:aws:sns:{self.region}:123456789012:photo-sharing-alerts'
                ]
            },
            
            # API レスポンス時間アラーム
            {
                'AlarmName': f'{self.namespace}-HighAPIResponseTime-{self.environment}',
                'AlarmDescription': 'API レスポンス時間が長すぎます',
                'MetricName': 'APIResponseTime',
                'Namespace': self.namespace,
                'Statistic': 'Average',
                'Period': 300,
                'EvaluationPeriods': 3,
                'Threshold': 2000.0,  # 2秒
                'ComparisonOperator': 'GreaterThanThreshold',
                'Dimensions': [
                    {'Name': 'Environment', 'Value': self.environment}
                ]
            },
            
            # データベースエラー率アラーム
            {
                'AlarmName': f'{self.namespace}-HighDatabaseErrorRate-{self.environment}',
                'AlarmDescription': 'データベースエラー率が高すぎます',
                'MetricName': 'DatabaseErrors',
                'Namespace': self.namespace,
                'Statistic': 'Sum',
                'Period': 300,
                'EvaluationPeriods': 2,
                'Threshold': 5.0,
                'ComparisonOperator': 'GreaterThanThreshold',
                'Dimensions': [
                    {'Name': 'Environment', 'Value': self.environment}
                ]
            },
            
            # データベース操作時間アラーム
            {
                'AlarmName': f'{self.namespace}-HighDatabaseOperationTime-{self.environment}',
                'AlarmDescription': 'データベース操作時間が長すぎます',
                'MetricName': 'DatabaseOperationTime',
                'Namespace': self.namespace,
                'Statistic': 'Average',
                'Period': 300,
                'EvaluationPeriods': 3,
                'Threshold': 1000.0,  # 1秒
                'ComparisonOperator': 'GreaterThanThreshold',
                'Dimensions': [
                    {'Name': 'Environment', 'Value': self.environment}
                ]
            },
            
            # 画像処理エラー率アラーム
            {
                'AlarmName': f'{self.namespace}-HighImageProcessingErrorRate-{self.environment}',
                'AlarmDescription': '画像処理エラー率が高すぎます',
                'MetricName': 'ImageProcessingErrors',
                'Namespace': self.namespace,
                'Statistic': 'Sum',
                'Period': 300,
                'EvaluationPeriods': 2,
                'Threshold': 3.0,
                'ComparisonOperator': 'GreaterThanThreshold',
                'Dimensions': [
                    {'Name': 'Environment', 'Value': self.environment}
                ]
            }
        ]
        
        return alarms
    
    def create_dashboard_config(self) -> Dict[str, Any]:
        """CloudWatch ダッシュボード設定を返す"""
        dashboard_body = {
            "widgets": [
                {
                    "type": "metric",
                    "x": 0,
                    "y": 0,
                    "width": 12,
                    "height": 6,
                    "properties": {
                        "metrics": [
                            [self.namespace, "APIRequests", "Environment", self.environment],
                            [".", "APIErrors", ".", "."]
                        ],
                        "period": 300,
                        "stat": "Sum",
                        "region": self.region,
                        "title": "API リクエスト数とエラー数"
                    }
                },
                {
                    "type": "metric",
                    "x": 12,
                    "y": 0,
                    "width": 12,
                    "height": 6,
                    "properties": {
                        "metrics": [
                            [self.namespace, "APIResponseTime", "Environment", self.environment]
                        ],
                        "period": 300,
                        "stat": "Average",
                        "region": self.region,
                        "title": "API レスポンス時間"
                    }
                },
                {
                    "type": "metric",
                    "x": 0,
                    "y": 6,
                    "width": 12,
                    "height": 6,
                    "properties": {
                        "metrics": [
                            [self.namespace, "DatabaseOperations", "Environment", self.environment],
                            [".", "DatabaseErrors", ".", "."]
                        ],
                        "period": 300,
                        "stat": "Sum",
                        "region": self.region,
                        "title": "データベース操作数とエラー数"
                    }
                },
                {
                    "type": "metric",
                    "x": 12,
                    "y": 6,
                    "width": 12,
                    "height": 6,
                    "properties": {
                        "metrics": [
                            [self.namespace, "DatabaseOperationTime", "Environment", self.environment]
                        ],
                        "period": 300,
                        "stat": "Average",
                        "region": self.region,
                        "title": "データベース操作時間"
                    }
                },
                {
                    "type": "metric",
                    "x": 0,
                    "y": 12,
                    "width": 12,
                    "height": 6,
                    "properties": {
                        "metrics": [
                            [self.namespace, "UserActivity", "Environment", self.environment]
                        ],
                        "period": 300,
                        "stat": "Sum",
                        "region": self.region,
                        "title": "ユーザーアクティビティ"
                    }
                },
                {
                    "type": "metric",
                    "x": 12,
                    "y": 12,
                    "width": 12,
                    "height": 6,
                    "properties": {
                        "metrics": [
                            [self.namespace, "ImageProcessing", "Environment", self.environment],
                            [".", "ImageProcessingErrors", ".", "."]
                        ],
                        "period": 300,
                        "stat": "Sum",
                        "region": self.region,
                        "title": "画像処理数とエラー数"
                    }
                }
            ]
        }
        
        return {
            'DashboardName': f'{self.namespace}-Dashboard-{self.environment}',
            'DashboardBody': json.dumps(dashboard_body)
        }
    
    def setup_log_groups(self) -> List[Dict[str, Any]]:
        """CloudWatch Logs グループの設定を返す"""
        log_groups = [
            {
                'logGroupName': f'/aws/lambda/{self.namespace}-api-{self.environment}',
                'retentionInDays': 14 if self.environment == 'development' else 30
            },
            {
                'logGroupName': f'/aws/lambda/{self.namespace}-image-processing-{self.environment}',
                'retentionInDays': 7 if self.environment == 'development' else 14
            },
            {
                'logGroupName': f'/aws/ecs/{self.namespace}-{self.environment}',
                'retentionInDays': 14 if self.environment == 'development' else 30
            }
        ]
        
        return log_groups
    
    def get_metrics_summary(self, hours: int = 24) -> Dict[str, Any]:
        """過去指定時間のメトリクス要約を取得"""
        if not self.enabled:
            return {'error': 'CloudWatch not enabled'}
        
        try:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=hours)
            
            # 主要メトリクスの取得
            metrics_to_fetch = [
                'APIRequests',
                'APIErrors', 
                'APIResponseTime',
                'DatabaseOperations',
                'DatabaseErrors',
                'UserActivity'
            ]
            
            summary = {}
            
            for metric_name in metrics_to_fetch:
                try:
                    response = self.cloudwatch.get_metric_statistics(
                        Namespace=self.namespace,
                        MetricName=metric_name,
                        Dimensions=[
                            {'Name': 'Environment', 'Value': self.environment}
                        ],
                        StartTime=start_time,
                        EndTime=end_time,
                        Period=3600,  # 1時間ごと
                        Statistics=['Sum', 'Average', 'Maximum']
                    )
                    
                    if response['Datapoints']:
                        datapoints = sorted(response['Datapoints'], key=lambda x: x['Timestamp'])
                        summary[metric_name] = {
                            'total': sum(dp.get('Sum', 0) for dp in datapoints),
                            'average': sum(dp.get('Average', 0) for dp in datapoints) / len(datapoints),
                            'maximum': max(dp.get('Maximum', 0) for dp in datapoints),
                            'datapoints_count': len(datapoints)
                        }
                    else:
                        summary[metric_name] = {
                            'total': 0,
                            'average': 0,
                            'maximum': 0,
                            'datapoints_count': 0
                        }
                        
                except Exception as e:
                    logger.error(f"Failed to fetch metric {metric_name}: {e}")
                    summary[metric_name] = {'error': str(e)}
            
            return summary
            
        except Exception as e:
            logger.error(f"Failed to get metrics summary: {e}")
            return {'error': str(e)}
    
    def __del__(self):
        """デストラクタでバッファをフラッシュ"""
        try:
            self._flush_metrics()
        except:
            pass

# グローバルインスタンス
cloudwatch_config = CloudWatchConfig()

def monitor_api_request(endpoint: str = None, method: str = None):
    """API リクエスト監視デコレータ"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            # Flask request から情報を取得
            try:
                from flask import request
                actual_endpoint = endpoint or request.endpoint or func.__name__
                actual_method = method or request.method
                user_id = getattr(request, 'user_id', None)
            except:
                actual_endpoint = endpoint or func.__name__
                actual_method = method or 'UNKNOWN'
                user_id = None
            
            try:
                result = func(*args, **kwargs)
                
                # 成功時のメトリクス記録
                duration_ms = (time.time() - start_time) * 1000
                status_code = getattr(result, 'status_code', 200)
                
                cloudwatch_config.record_api_request(
                    actual_endpoint, 
                    actual_method, 
                    status_code, 
                    duration_ms, 
                    user_id
                )
                
                return result
                
            except Exception as e:
                # エラー時のメトリクス記録
                duration_ms = (time.time() - start_time) * 1000
                status_code = 500
                
                cloudwatch_config.record_api_request(
                    actual_endpoint, 
                    actual_method, 
                    status_code, 
                    duration_ms, 
                    user_id
                )
                
                raise
        
        return wrapper
    return decorator

def monitor_database_operation(operation: str, table_name: str):
    """データベース操作監視デコレータ"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                
                # 成功時のメトリクス記録
                duration_ms = (time.time() - start_time) * 1000
                cloudwatch_config.record_database_operation(
                    operation, 
                    table_name, 
                    duration_ms, 
                    True
                )
                
                return result
                
            except Exception as e:
                # エラー時のメトリクス記録
                duration_ms = (time.time() - start_time) * 1000
                cloudwatch_config.record_database_operation(
                    operation, 
                    table_name, 
                    duration_ms, 
                    False
                )
                
                raise
        
        return wrapper
    return decorator
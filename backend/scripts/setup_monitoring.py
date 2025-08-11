#!/usr/bin/env python3
"""
モニタリング設定セットアップスクリプト
要件6.4: CloudWatchメトリクス・アラーム設定
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List

# プロジェクトルートをパスに追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.cloudwatch_config import cloudwatch_config
from shared.logging_config import get_logger

logger = get_logger(__name__)

def setup_cloudwatch_alarms():
    """CloudWatch アラームの設定"""
    if not cloudwatch_config.enabled:
        logger.info("CloudWatch is not enabled. Skipping alarm setup.")
        return
    
    try:
        alarms = cloudwatch_config.create_alarms()
        
        for alarm_config in alarms:
            try:
                cloudwatch_config.cloudwatch.put_metric_alarm(**alarm_config)
                logger.info(f"Created alarm: {alarm_config['AlarmName']}")
                
            except Exception as e:
                logger.error(f"Failed to create alarm {alarm_config['AlarmName']}: {e}")
        
        logger.info(f"Successfully set up {len(alarms)} CloudWatch alarms")
        
    except Exception as e:
        logger.error(f"Failed to setup CloudWatch alarms: {e}")
        raise

def setup_cloudwatch_dashboard():
    """CloudWatch ダッシュボードの設定"""
    if not cloudwatch_config.enabled:
        logger.info("CloudWatch is not enabled. Skipping dashboard setup.")
        return
    
    try:
        dashboard_config = cloudwatch_config.create_dashboard_config()
        
        cloudwatch_config.cloudwatch.put_dashboard(**dashboard_config)
        logger.info(f"Created dashboard: {dashboard_config['DashboardName']}")
        
    except Exception as e:
        logger.error(f"Failed to setup CloudWatch dashboard: {e}")
        raise

def setup_log_groups():
    """CloudWatch Logs グループの設定"""
    if not cloudwatch_config.enabled:
        logger.info("CloudWatch is not enabled. Skipping log groups setup.")
        return
    
    try:
        log_groups = cloudwatch_config.setup_log_groups()
        
        for log_group in log_groups:
            try:
                # ロググループの作成
                cloudwatch_config.logs_client.create_log_group(
                    logGroupName=log_group['logGroupName']
                )
                logger.info(f"Created log group: {log_group['logGroupName']}")
                
                # 保持期間の設定
                cloudwatch_config.logs_client.put_retention_policy(
                    logGroupName=log_group['logGroupName'],
                    retentionInDays=log_group['retentionInDays']
                )
                logger.info(f"Set retention policy for {log_group['logGroupName']}: {log_group['retentionInDays']} days")
                
            except cloudwatch_config.logs_client.exceptions.ResourceAlreadyExistsException:
                logger.info(f"Log group already exists: {log_group['logGroupName']}")
                
                # 既存のロググループの保持期間を更新
                try:
                    cloudwatch_config.logs_client.put_retention_policy(
                        logGroupName=log_group['logGroupName'],
                        retentionInDays=log_group['retentionInDays']
                    )
                    logger.info(f"Updated retention policy for {log_group['logGroupName']}")
                except Exception as e:
                    logger.warning(f"Failed to update retention policy for {log_group['logGroupName']}: {e}")
                    
            except Exception as e:
                logger.error(f"Failed to create log group {log_group['logGroupName']}: {e}")
        
        logger.info(f"Successfully set up {len(log_groups)} log groups")
        
    except Exception as e:
        logger.error(f"Failed to setup log groups: {e}")
        raise

def create_monitoring_config_file():
    """モニタリング設定ファイルの作成"""
    config = {
        "monitoring": {
            "enabled": cloudwatch_config.enabled,
            "namespace": cloudwatch_config.namespace,
            "environment": cloudwatch_config.environment,
            "region": cloudwatch_config.region
        },
        "alarms": cloudwatch_config.create_alarms(),
        "dashboard": cloudwatch_config.create_dashboard_config(),
        "log_groups": cloudwatch_config.setup_log_groups(),
        "metrics": {
            "api_requests": {
                "description": "API リクエスト数",
                "unit": "Count",
                "dimensions": ["Environment", "Endpoint", "Method", "StatusCode"]
            },
            "api_response_time": {
                "description": "API レスポンス時間",
                "unit": "Milliseconds",
                "dimensions": ["Environment", "Endpoint", "Method"]
            },
            "database_operations": {
                "description": "データベース操作数",
                "unit": "Count",
                "dimensions": ["Environment", "Operation", "TableName"]
            },
            "database_operation_time": {
                "description": "データベース操作時間",
                "unit": "Milliseconds",
                "dimensions": ["Environment", "Operation", "TableName"]
            },
            "user_activity": {
                "description": "ユーザーアクティビティ",
                "unit": "Count",
                "dimensions": ["Environment", "ActivityType"]
            },
            "image_processing": {
                "description": "画像処理数",
                "unit": "Count",
                "dimensions": ["Environment", "Operation"]
            }
        }
    }
    
    config_file_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'monitoring_config.json')
    os.makedirs(os.path.dirname(config_file_path), exist_ok=True)
    
    with open(config_file_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False, default=str)
    
    logger.info(f"Created monitoring configuration file: {config_file_path}")
    return config_file_path

def validate_monitoring_setup():
    """モニタリング設定の検証"""
    logger.info("Validating monitoring setup...")
    
    validation_results = {
        'cloudwatch_enabled': cloudwatch_config.enabled,
        'xray_enabled': False,
        'dynamodb_optimizer_available': False,
        'issues': []
    }
    
    # X-Ray の確認
    try:
        from shared.xray_config import xray_config
        validation_results['xray_enabled'] = xray_config.enabled
    except Exception as e:
        validation_results['issues'].append(f"X-Ray configuration issue: {e}")
    
    # DynamoDB Optimizer の確認
    try:
        from shared.dynamodb_optimizer import dynamodb_optimizer
        validation_results['dynamodb_optimizer_available'] = True
    except Exception as e:
        validation_results['issues'].append(f"DynamoDB Optimizer issue: {e}")
    
    # 環境変数の確認
    required_env_vars = ['ENVIRONMENT', 'AWS_REGION']
    for env_var in required_env_vars:
        if not os.getenv(env_var):
            validation_results['issues'].append(f"Missing environment variable: {env_var}")
    
    # CloudWatch 接続テスト
    if cloudwatch_config.enabled:
        try:
            cloudwatch_config.cloudwatch.list_metrics(Namespace=cloudwatch_config.namespace, MaxRecords=1)
            validation_results['cloudwatch_connection'] = True
        except Exception as e:
            validation_results['cloudwatch_connection'] = False
            validation_results['issues'].append(f"CloudWatch connection failed: {e}")
    
    # 結果の出力
    logger.info("Monitoring setup validation results:")
    logger.info(f"  CloudWatch enabled: {validation_results['cloudwatch_enabled']}")
    logger.info(f"  X-Ray enabled: {validation_results['xray_enabled']}")
    logger.info(f"  DynamoDB Optimizer available: {validation_results['dynamodb_optimizer_available']}")
    
    if validation_results['issues']:
        logger.warning("Issues found:")
        for issue in validation_results['issues']:
            logger.warning(f"  - {issue}")
    else:
        logger.info("No issues found. Monitoring setup is valid.")
    
    return validation_results

def generate_terraform_config():
    """Terraform 設定ファイルの生成"""
    terraform_config = {
        "resource": {
            "aws_cloudwatch_metric_alarm": {},
            "aws_cloudwatch_dashboard": {},
            "aws_cloudwatch_log_group": {}
        }
    }
    
    # アラーム設定
    alarms = cloudwatch_config.create_alarms()
    for i, alarm in enumerate(alarms):
        resource_name = f"alarm_{i}"
        terraform_config["resource"]["aws_cloudwatch_metric_alarm"][resource_name] = {
            "alarm_name": alarm["AlarmName"],
            "alarm_description": alarm["AlarmDescription"],
            "metric_name": alarm["MetricName"],
            "namespace": alarm["Namespace"],
            "statistic": alarm["Statistic"],
            "period": alarm["Period"],
            "evaluation_periods": alarm["EvaluationPeriods"],
            "threshold": alarm["Threshold"],
            "comparison_operator": alarm["ComparisonOperator"],
            "dimensions": {dim["Name"]: dim["Value"] for dim in alarm.get("Dimensions", [])}
        }
    
    # ダッシュボード設定
    dashboard_config = cloudwatch_config.create_dashboard_config()
    terraform_config["resource"]["aws_cloudwatch_dashboard"]["main"] = {
        "dashboard_name": dashboard_config["DashboardName"],
        "dashboard_body": dashboard_config["DashboardBody"]
    }
    
    # ロググループ設定
    log_groups = cloudwatch_config.setup_log_groups()
    for i, log_group in enumerate(log_groups):
        resource_name = f"log_group_{i}"
        terraform_config["resource"]["aws_cloudwatch_log_group"][resource_name] = {
            "name": log_group["logGroupName"],
            "retention_in_days": log_group["retentionInDays"]
        }
    
    terraform_file_path = os.path.join(os.path.dirname(__file__), '..', 'terraform', 'monitoring.tf.json')
    os.makedirs(os.path.dirname(terraform_file_path), exist_ok=True)
    
    with open(terraform_file_path, 'w', encoding='utf-8') as f:
        json.dump(terraform_config, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Generated Terraform configuration: {terraform_file_path}")
    return terraform_file_path

def main():
    """メイン実行関数"""
    parser = argparse.ArgumentParser(description='Setup monitoring configuration')
    parser.add_argument('--setup-alarms', action='store_true', help='Setup CloudWatch alarms')
    parser.add_argument('--setup-dashboard', action='store_true', help='Setup CloudWatch dashboard')
    parser.add_argument('--setup-logs', action='store_true', help='Setup CloudWatch log groups')
    parser.add_argument('--create-config', action='store_true', help='Create monitoring configuration file')
    parser.add_argument('--validate', action='store_true', help='Validate monitoring setup')
    parser.add_argument('--generate-terraform', action='store_true', help='Generate Terraform configuration')
    parser.add_argument('--all', action='store_true', help='Run all setup tasks')
    
    args = parser.parse_args()
    
    if not any(vars(args).values()):
        parser.print_help()
        return
    
    try:
        if args.all or args.validate:
            validate_monitoring_setup()
        
        if args.all or args.setup_alarms:
            setup_cloudwatch_alarms()
        
        if args.all or args.setup_dashboard:
            setup_cloudwatch_dashboard()
        
        if args.all or args.setup_logs:
            setup_log_groups()
        
        if args.all or args.create_config:
            create_monitoring_config_file()
        
        if args.all or args.generate_terraform:
            generate_terraform_config()
        
        logger.info("Monitoring setup completed successfully!")
        
    except Exception as e:
        logger.error(f"Monitoring setup failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
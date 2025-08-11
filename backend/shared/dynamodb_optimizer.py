"""
DynamoDB クエリ最適化とパフォーマンス監視
要件6.4: DynamoDBクエリ最適化とインデックス調整
"""

import time
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from botocore.exceptions import ClientError
from .logging_config import get_logger
from .dynamodb import db_connection
from .monitoring import monitor_database_operation

logger = get_logger(__name__)

class DynamoDBOptimizer:
    """DynamoDB クエリ最適化とパフォーマンス監視クラス"""
    
    def __init__(self):
        self.db = db_connection
        self.query_metrics = {}
        self.slow_query_threshold = 1.0  # 1秒以上のクエリを遅いクエリとして記録
    
    def optimize_timeline_query(self, limit: int = 20, last_key: Dict[str, str] = None) -> Dict[str, Any]:
        """
        タイムライン取得クエリの最適化
        GSI (Global Secondary Index) を使用してスキャンを回避
        """
        @monitor_database_operation('timeline_query_optimized', 'posts')
        def _optimized_timeline_query():
            start_time = time.time()
            
            try:
                table = self.db.get_table('posts')
                
                # GSI 'timeline-index' を使用（created_at をソートキーとして使用）
                # 実際の実装では、すべての投稿に共通のパーティションキー（例：'TIMELINE'）を追加
                query_params = {
                    'IndexName': 'timeline-index',
                    'KeyConditionExpression': 'timeline_pk = :timeline_pk',
                    'ExpressionAttributeValues': {':timeline_pk': 'TIMELINE'},
                    'ScanIndexForward': False,  # 最新順でソート
                    'Limit': limit
                }
                
                if last_key:
                    query_params['ExclusiveStartKey'] = last_key
                
                response = table.query(**query_params)
                
                # クエリ時間を記録
                query_time = time.time() - start_time
                self._record_query_metrics('timeline_query', query_time, len(response['Items']))
                
                return {
                    'posts': response['Items'],
                    'last_evaluated_key': response.get('LastEvaluatedKey'),
                    'has_more': 'LastEvaluatedKey' in response,
                    'query_time': query_time
                }
                
            except Exception as e:
                logger.error(f"Optimized timeline query failed: {e}")
                # フォールバック：従来のスキャン方式
                return self._fallback_timeline_scan(limit, last_key)
        
        return _optimized_timeline_query()
    
    def _fallback_timeline_scan(self, limit: int, last_key: Dict[str, str] = None) -> Dict[str, Any]:
        """タイムライン取得のフォールバック（スキャン方式）"""
        start_time = time.time()
        
        try:
            table = self.db.get_table('posts')
            
            scan_params = {
                'Limit': limit * 2,  # スキャンの場合は多めに取得してソート
                'Select': 'ALL_ATTRIBUTES'
            }
            
            if last_key:
                scan_params['ExclusiveStartKey'] = last_key
            
            response = table.scan(**scan_params)
            
            # created_at でソート
            items = sorted(response['Items'], key=lambda x: x['created_at'], reverse=True)
            
            # 指定された数まで制限
            items = items[:limit]
            
            query_time = time.time() - start_time
            self._record_query_metrics('timeline_scan_fallback', query_time, len(items))
            
            return {
                'posts': items,
                'last_evaluated_key': response.get('LastEvaluatedKey'),
                'has_more': 'LastEvaluatedKey' in response,
                'query_time': query_time
            }
            
        except Exception as e:
            logger.error(f"Fallback timeline scan failed: {e}")
            raise
    
    def optimize_user_posts_query(self, user_id: str, limit: int = 20, 
                                 last_key: Dict[str, str] = None) -> Dict[str, Any]:
        """ユーザー投稿取得クエリの最適化"""
        @monitor_database_operation('user_posts_query_optimized', 'posts')
        def _optimized_user_posts_query():
            start_time = time.time()
            
            try:
                table = self.db.get_table('posts')
                
                query_params = {
                    'IndexName': 'user-posts-index',
                    'KeyConditionExpression': 'user_id = :user_id',
                    'ExpressionAttributeValues': {':user_id': user_id},
                    'ScanIndexForward': False,  # 最新順
                    'Limit': limit,
                    # プロジェクション式で必要な属性のみ取得
                    'ProjectionExpression': 'post_id, user_id, image_key, caption, likes_count, comments_count, created_at'
                }
                
                if last_key:
                    query_params['ExclusiveStartKey'] = last_key
                
                response = table.query(**query_params)
                
                query_time = time.time() - start_time
                self._record_query_metrics('user_posts_query', query_time, len(response['Items']))
                
                return {
                    'posts': response['Items'],
                    'last_evaluated_key': response.get('LastEvaluatedKey'),
                    'has_more': 'LastEvaluatedKey' in response,
                    'query_time': query_time
                }
                
            except Exception as e:
                logger.error(f"Optimized user posts query failed for user {user_id}: {e}")
                raise
        
        return _optimized_user_posts_query()
    
    def optimize_interactions_query(self, post_id: str, interaction_type: str = None, 
                                  limit: int = 50) -> List[Dict[str, Any]]:
        """インタラクション取得クエリの最適化"""
        @monitor_database_operation('interactions_query_optimized', 'interactions')
        def _optimized_interactions_query():
            start_time = time.time()
            
            try:
                table = self.db.get_table('interactions')
                
                query_params = {
                    'KeyConditionExpression': 'post_id = :post_id',
                    'ExpressionAttributeValues': {':post_id': post_id},
                    'Limit': limit,
                    'ScanIndexForward': False  # 最新順
                }
                
                # 特定のインタラクションタイプでフィルタ
                if interaction_type:
                    query_params['KeyConditionExpression'] += ' AND begins_with(interaction_id, :type_prefix)'
                    query_params['ExpressionAttributeValues'][':type_prefix'] = f'{interaction_type}#'
                
                response = table.query(**query_params)
                
                query_time = time.time() - start_time
                self._record_query_metrics('interactions_query', query_time, len(response['Items']))
                
                return response['Items']
                
            except Exception as e:
                logger.error(f"Optimized interactions query failed for post {post_id}: {e}")
                raise
        
        return _optimized_interactions_query()
    
    def batch_get_users(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """ユーザー情報の一括取得（N+1問題の解決）"""
        @monitor_database_operation('batch_get_users', 'users')
        def _batch_get_users():
            start_time = time.time()
            
            try:
                # DynamoDB BatchGetItem の制限（100件まで）を考慮
                batch_size = 100
                all_users = {}
                
                for i in range(0, len(user_ids), batch_size):
                    batch_user_ids = user_ids[i:i + batch_size]
                    
                    # BatchGetItem リクエストの構築
                    request_items = {
                        'users': {
                            'Keys': [{'user_id': user_id} for user_id in batch_user_ids],
                            'ProjectionExpression': 'user_id, username, profile_image, bio'
                        }
                    }
                    
                    response = self.db.dynamodb.batch_get_item(RequestItems=request_items)
                    
                    # レスポンスの処理
                    for item in response['Responses']['users']:
                        all_users[item['user_id']] = item
                    
                    # 未処理のアイテムがある場合の処理
                    while response.get('UnprocessedKeys'):
                        response = self.db.dynamodb.batch_get_item(
                            RequestItems=response['UnprocessedKeys']
                        )
                        for item in response['Responses']['users']:
                            all_users[item['user_id']] = item
                
                query_time = time.time() - start_time
                self._record_query_metrics('batch_get_users', query_time, len(all_users))
                
                return all_users
                
            except Exception as e:
                logger.error(f"Batch get users failed: {e}")
                raise
        
        return _batch_get_users()
    
    def get_post_with_user_info(self, post_id: str) -> Optional[Dict[str, Any]]:
        """投稿とユーザー情報を効率的に取得"""
        @monitor_database_operation('post_with_user_info', 'posts')
        def _get_post_with_user_info():
            start_time = time.time()
            
            try:
                # 投稿情報を取得
                posts_table = self.db.get_table('posts')
                post_response = posts_table.get_item(Key={'post_id': post_id})
                
                if 'Item' not in post_response:
                    return None
                
                post = post_response['Item']
                
                # ユーザー情報を取得
                users_table = self.db.get_table('users')
                user_response = users_table.get_item(
                    Key={'user_id': post['user_id']},
                    ProjectionExpression='user_id, username, profile_image, bio'
                )
                
                if 'Item' in user_response:
                    post['user'] = user_response['Item']
                
                query_time = time.time() - start_time
                self._record_query_metrics('post_with_user_info', query_time, 1)
                
                return post
                
            except Exception as e:
                logger.error(f"Get post with user info failed for post {post_id}: {e}")
                raise
        
        return _get_post_with_user_info()
    
    def _record_query_metrics(self, query_type: str, execution_time: float, item_count: int):
        """クエリメトリクスの記録"""
        if query_type not in self.query_metrics:
            self.query_metrics[query_type] = {
                'total_queries': 0,
                'total_time': 0,
                'total_items': 0,
                'slow_queries': 0,
                'max_time': 0,
                'min_time': float('inf')
            }
        
        metrics = self.query_metrics[query_type]
        metrics['total_queries'] += 1
        metrics['total_time'] += execution_time
        metrics['total_items'] += item_count
        metrics['max_time'] = max(metrics['max_time'], execution_time)
        metrics['min_time'] = min(metrics['min_time'], execution_time)
        
        if execution_time > self.slow_query_threshold:
            metrics['slow_queries'] += 1
            logger.warning(f"Slow query detected: {query_type} took {execution_time:.2f}s")
    
    def get_query_metrics(self) -> Dict[str, Any]:
        """クエリメトリクスの取得"""
        summary = {}
        
        for query_type, metrics in self.query_metrics.items():
            if metrics['total_queries'] > 0:
                summary[query_type] = {
                    'total_queries': metrics['total_queries'],
                    'avg_time': metrics['total_time'] / metrics['total_queries'],
                    'avg_items_per_query': metrics['total_items'] / metrics['total_queries'],
                    'slow_query_percentage': (metrics['slow_queries'] / metrics['total_queries']) * 100,
                    'max_time': metrics['max_time'],
                    'min_time': metrics['min_time'] if metrics['min_time'] != float('inf') else 0
                }
        
        return summary
    
    def optimize_conditional_updates(self, table_name: str, key: Dict[str, Any], 
                                   updates: Dict[str, Any], conditions: Dict[str, Any] = None) -> bool:
        """条件付き更新の最適化"""
        @monitor_database_operation('conditional_update', table_name)
        def _optimized_conditional_update():
            start_time = time.time()
            
            try:
                table = self.db.get_table(table_name)
                
                # 更新式の構築
                update_expression = "SET "
                expression_attribute_values = {}
                expression_attribute_names = {}
                
                for attr, value in updates.items():
                    attr_name = f"#{attr}"
                    attr_value = f":{attr}"
                    
                    update_expression += f"{attr_name} = {attr_value}, "
                    expression_attribute_names[attr_name] = attr
                    expression_attribute_values[attr_value] = value
                
                update_expression = update_expression.rstrip(', ')
                
                # 条件式の構築
                condition_expression = None
                if conditions:
                    condition_parts = []
                    for attr, condition in conditions.items():
                        if isinstance(condition, dict):
                            for op, value in condition.items():
                                attr_name = f"#cond_{attr}"
                                attr_value = f":cond_{attr}"
                                
                                expression_attribute_names[attr_name] = attr
                                expression_attribute_values[attr_value] = value
                                
                                if op == 'exists':
                                    condition_parts.append(f"attribute_exists({attr_name})")
                                elif op == 'not_exists':
                                    condition_parts.append(f"attribute_not_exists({attr_name})")
                                elif op == 'eq':
                                    condition_parts.append(f"{attr_name} = {attr_value}")
                                elif op == 'ne':
                                    condition_parts.append(f"{attr_name} <> {attr_value}")
                                elif op == 'gt':
                                    condition_parts.append(f"{attr_name} > {attr_value}")
                                elif op == 'lt':
                                    condition_parts.append(f"{attr_name} < {attr_value}")
                    
                    condition_expression = ' AND '.join(condition_parts)
                
                # 更新実行
                update_params = {
                    'Key': key,
                    'UpdateExpression': update_expression,
                    'ExpressionAttributeNames': expression_attribute_names,
                    'ExpressionAttributeValues': expression_attribute_values,
                    'ReturnValues': 'UPDATED_NEW'
                }
                
                if condition_expression:
                    update_params['ConditionExpression'] = condition_expression
                
                response = table.update_item(**update_params)
                
                query_time = time.time() - start_time
                self._record_query_metrics('conditional_update', query_time, 1)
                
                return True
                
            except ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    logger.info(f"Conditional update failed due to condition: {conditions}")
                    return False
                else:
                    logger.error(f"Conditional update failed: {e}")
                    raise
            except Exception as e:
                logger.error(f"Conditional update failed: {e}")
                raise
        
        return _optimized_conditional_update()
    
    def create_optimized_indexes(self):
        """最適化されたインデックスの作成提案"""
        index_recommendations = {
            'posts': [
                {
                    'IndexName': 'timeline-index',
                    'KeySchema': [
                        {'AttributeName': 'timeline_pk', 'KeyType': 'HASH'},
                        {'AttributeName': 'created_at', 'KeyType': 'RANGE'}
                    ],
                    'AttributeDefinitions': [
                        {'AttributeName': 'timeline_pk', 'AttributeType': 'S'},
                        {'AttributeName': 'created_at', 'AttributeType': 'S'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'Purpose': 'タイムライン取得の最適化（スキャン回避）'
                },
                {
                    'IndexName': 'user-posts-index',
                    'KeySchema': [
                        {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'created_at', 'KeyType': 'RANGE'}
                    ],
                    'AttributeDefinitions': [
                        {'AttributeName': 'user_id', 'AttributeType': 'S'},
                        {'AttributeName': 'created_at', 'AttributeType': 'S'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'Purpose': 'ユーザー投稿一覧の効率的な取得'
                }
            ],
            'users': [
                {
                    'IndexName': 'username-index',
                    'KeySchema': [
                        {'AttributeName': 'username', 'KeyType': 'HASH'}
                    ],
                    'AttributeDefinitions': [
                        {'AttributeName': 'username', 'AttributeType': 'S'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'Purpose': 'ユーザー名による検索の最適化'
                },
                {
                    'IndexName': 'email-index',
                    'KeySchema': [
                        {'AttributeName': 'email', 'KeyType': 'HASH'}
                    ],
                    'AttributeDefinitions': [
                        {'AttributeName': 'email', 'AttributeType': 'S'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'Purpose': 'メールアドレスによる検索の最適化'
                }
            ],
            'interactions': [
                {
                    'IndexName': 'user-interactions-index',
                    'KeySchema': [
                        {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'created_at', 'KeyType': 'RANGE'}
                    ],
                    'AttributeDefinitions': [
                        {'AttributeName': 'user_id', 'AttributeType': 'S'},
                        {'AttributeName': 'created_at', 'AttributeType': 'S'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'Purpose': 'ユーザーのインタラクション履歴取得'
                }
            ]
        }
        
        return index_recommendations
    
    def analyze_table_performance(self, table_name: str) -> Dict[str, Any]:
        """テーブルパフォーマンスの分析"""
        try:
            table = self.db.get_table(table_name)
            
            # テーブル情報の取得
            table_description = table.meta.client.describe_table(TableName=table_name)
            table_info = table_description['Table']
            
            analysis = {
                'table_name': table_name,
                'item_count': table_info.get('ItemCount', 0),
                'table_size_bytes': table_info.get('TableSizeBytes', 0),
                'provisioned_throughput': table_info.get('ProvisionedThroughput', {}),
                'global_secondary_indexes': [],
                'recommendations': []
            }
            
            # GSI 情報の取得
            if 'GlobalSecondaryIndexes' in table_info:
                for gsi in table_info['GlobalSecondaryIndexes']:
                    analysis['global_secondary_indexes'].append({
                        'index_name': gsi['IndexName'],
                        'key_schema': gsi['KeySchema'],
                        'item_count': gsi.get('ItemCount', 0),
                        'index_size_bytes': gsi.get('IndexSizeBytes', 0),
                        'provisioned_throughput': gsi.get('ProvisionedThroughput', {})
                    })
            
            # パフォーマンス推奨事項
            if analysis['item_count'] > 10000:
                analysis['recommendations'].append(
                    "大量のデータがあります。クエリパターンを見直し、適切なGSIの使用を検討してください。"
                )
            
            if not analysis['global_secondary_indexes']:
                analysis['recommendations'].append(
                    "GSIが設定されていません。クエリパフォーマンス向上のためGSIの追加を検討してください。"
                )
            
            return analysis
            
        except Exception as e:
            logger.error(f"Table performance analysis failed for {table_name}: {e}")
            raise

# グローバルインスタンス
dynamodb_optimizer = DynamoDBOptimizer()
"""
Celery 앱 설정
broker: RabbitMQ, backend: Redis
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://antenna:localdev@localhost:5672//')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

celery_app = Celery(
    'antenna',
    broker=RABBITMQ_URL,
    backend=REDIS_URL,
    include=['tasks.backtest'],   # worker 시작 시 자동 import
)

celery_app.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    result_expires=3600,       # 결과 1시간 후 자동 삭제
    task_track_started=True,
    worker_prefetch_multiplier=1,  # 한 번에 1개씩 처리
)

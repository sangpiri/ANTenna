# ANTenna - Stock Calendar & Search

<div align="center">
  <img src="logo.png" alt="ANTenna Logo" width="120" />

  <p><strong>개미 트레이더들을 위한 매수 신호 수신기, ANTenna</strong></p>
  <p><em>한국/미국 주식 데이터 분석 및 포트폴리오 관리 웹 애플리케이션</em></p>

  ![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)
  ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
  ![Python](https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white)
  ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)
</div>

---

## 목차

1. [Overview](#1-overview) - 개요
2. [Features](#2-features) - 주요 기능
3. [Tech Stack](#3-tech-stack) - 기술 스택
4. [Project Structure](#4-project-structure) - 프로젝트 구조
5. [Architecture](#5-architecture) - 아키텍처
6. [API Endpoints](#6-api-endpoints) - API 엔드포인트
7. [Getting Started](#7-getting-started) - 시작하기
8. [Demo](#8-demo) - 시연 영상
9. [Key Implementation Highlights](#9-key-implementation-highlights) - 핵심 구현 사항
10. [Future Improvements](#10-future-improvements) - 향후 개선 사항
11. [License](#11-license) - 라이선스

---

## 1. Overview

**ANTenna**는 한국 및 미국 주식 시장의 데이터를 직관적인 캘린더 인터페이스로 조회하고, 다양한 분석 기능을 제공하는 풀스택 웹 애플리케이션입니다.

사용자는 특정 날짜의 거래대금/상승률 상위 종목을 확인하고, 빈출 종목, 눌림목 종목, 연속 상승 종목 등의 분석 결과를 실시간으로 조회할 수 있습니다. 또한 IP 기반의 개인화된 즐겨찾기 및 메모 기능을 통해 자신만의 포트폴리오를 관리할 수 있습니다.

---

## 2. Features

### 주식 데이터 조회
- **캘린더 기반 조회**: 날짜를 선택하여 해당일의 거래대금/상승률 상위 300개 종목 조회
- **가격대별 필터링** (미국주식): $10 이상 / $5~$10 / $5 미만으로 구분
- **3단계 정렬**: 컬럼 클릭 시 내림차순 → 오름차순 → 정렬 해제 순환
- **실시간 검색**: 종목코드/이름 자동완성 검색

### 종목 분석 기능
| 분석 유형 | 설명 |
|----------|------|
| **빈출 종목** | 최근 N주간 상위 300위에 자주 등장한 종목 순위 |
| **눌림목** | N일 전 상승 후 현재 하락 중인 종목 탐지 |
| **연속 상승** | 2~4일 연속 상승 중인 종목 필터링 |

### 고급 갭 분석 (미국주식)
- **3단계 필터링 시스템**:
  - 기준: 전일종가/당일시가/당일종가 비교
  - 추가 기준: 상승/하락 방향 필터
  - 세부 기준: 익일 시가/종가 추가 조건
- **MA240 위치 표시**: 정배열/역배열 구분
- **가격대 필터**: 결과 내 추가 필터링

### 차트 기능
- **라인 차트**: 종가 추이 시각화
- **캔들 차트**: OHLC 데이터 표시 (양봉: 빨강, 음봉: 파랑)
- **거래대금 차트**: 상승/하락일 색상 구분
- **이동평균선**: 20일선, 240일선 표시
- **변동률 표시**: 1일/5일/20일/60일/120일 변동률

### 사용자 기능 (IP 기반 개인화)
- **폴더 관리**: 생성/삭제/이름변경/순서변경
- **즐겨찾기**: 폴더별 종목 관리, 드래그로 순서 변경
- **메모**: 종목별 메모 저장 및 조회

---

## 3. Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** | 고성능 비동기 웹 프레임워크 |
| **Uvicorn** | ASGI 서버 |
| **Pandas** | 데이터 처리 및 분석 |
| **Pydantic** | 데이터 검증 및 직렬화 |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI 컴포넌트 라이브러리 |
| **TypeScript** | 정적 타입 시스템 |
| **Vite** | 차세대 빌드 도구 |
| **TailwindCSS** | 유틸리티 기반 스타일링 |
| **React Query** | 서버 상태 관리 및 캐싱 |
| **Lightweight Charts** | 금융 차트 라이브러리 |
| **Axios** | HTTP 클라이언트 |

---

## 4. Project Structure

```
ANTenna/
├── backend/
│   ├── main.py                 # FastAPI 애플리케이션 진입점
│   ├── data/                   # 주식 데이터 저장 (※ 용량이 크므로 scripts/로 수집 필요)
│   │   ├── kr_stock_data.csv   # 한국주식 데이터
│   │   └── us_stock_data.csv   # 미국주식 데이터
│   ├── routers/
│   │   ├── kr_stock.py         # 한국주식 API 엔드포인트
│   │   ├── us_stock.py         # 미국주식 API 엔드포인트
│   │   └── user.py             # 사용자 데이터 API
│   ├── services/
│   │   ├── data_manager.py     # 주식 데이터 처리 로직
│   │   └── user_manager.py     # 사용자 데이터 관리
│   ├── models/
│   │   └── schemas.py          # Pydantic 데이터 모델
│   └── scripts/                # 데이터 수집 스크립트
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # 메인 애플리케이션
│   │   ├── components/
│   │   │   ├── common/         # 공용 컴포넌트
│   │   │   │   ├── MarketTabs.tsx
│   │   │   │   ├── StockTable.tsx
│   │   │   │   ├── ChartModal.tsx
│   │   │   │   ├── Calendar.tsx
│   │   │   │   └── ...
│   │   │   ├── kr/             # 한국주식 컴포넌트
│   │   │   └── us/             # 미국주식 컴포넌트
│   │   ├── services/
│   │   │   └── api.ts          # API 클라이언트
│   │   ├── hooks/              # 커스텀 React 훅
│   │   └── types/              # TypeScript 타입 정의
│   └── package.json
│
├── user_data/                  # 사용자별 JSON 데이터 저장
├── start.bat                   # 프로덕션 실행 스크립트
└── dev.bat                     # 개발 모드 실행 스크립트
```

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     React Application                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Components │  │   Hooks     │  │    React Query Cache    │ │
│  │  (UI Layer) │◄─┤ (Data Fetch)│◄─┤  (Server State Mgmt)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │ Axios
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Routers   │─▶│  Services   │─▶│   Data Manager          │ │
│  │ (Endpoints) │  │  (Business) │  │ (Pandas Processing)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Storage                               │
│  ┌───────────────────────┐  ┌─────────────────────────────────┐│
│  │  CSV Files (Stock)    │  │  JSON Files (User Data by IP)  ││
│  │  - kr_stock_data.csv  │  │  - user_data_{ip}.json         ││
│  │  - us_stock_data.csv  │  │                                 ││
│  └───────────────────────┘  └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. API Endpoints

### 한국주식 API (`/api/kr`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dates` | 거래일 목록 조회 |
| GET | `/data` | 특정 날짜 주식 데이터 |
| GET | `/frequent` | 빈출 종목 Top 100 |
| GET | `/pullback` | 눌림목 종목 |
| GET | `/consecutive` | 연속 상승 종목 |
| GET | `/history` | 종목 차트 데이터 |
| GET | `/search` | 종목 검색 |

### 미국주식 API (`/api/us`)
한국주식 API와 동일 + 추가 엔드포인트:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/gap-analysis` | 갭 상승 분석 (3단계 필터) |

### 사용자 API (`/api/user`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/folders` | 폴더 목록 |
| POST | `/folder/create` | 폴더 생성 |
| GET | `/favorites/all` | 전체 즐겨찾기 |
| POST | `/favorite/add` | 즐겨찾기 추가 |
| GET | `/memo` | 메모 조회 |
| POST | `/memo/save` | 메모 저장 |

---

## 7. Getting Started

### Prerequisites
- Python 3.8+
- Node.js 18+
- npm or yarn

### Installation

```bash
# 1. 저장소 클론
git clone https://github.com/yourusername/antenna-stock.git
cd antenna-stock/ANTenna

# 2. Backend 의존성 설치
cd backend
pip install -r requirements.txt

# 3. Frontend 의존성 설치
cd ../frontend
npm install

# 4. 주식 데이터 수집 (※ CSV 파일은 용량이 커서 저장소에 미포함)
cd ../backend/scripts
python kr_stock_basic.py   # 한국주식 데이터 수집
python us_stock_basic.py   # 미국주식 데이터 수집
python kr_stock_update.py  # 한국주식 데이터 업데이트
python us_stock_update.py  # 미국주식 데이터 업데이트
```

### Running the Application

**프로덕션 모드**
```bash
# Windows
start.bat

# 또는 수동 실행
cd frontend && npm run build
cd ../backend && python main.py
# http://localhost:7002 접속
```

**개발 모드**
```bash
# Windows
dev.bat

# 또는 수동 실행
# Terminal 1: Backend
cd backend && uvicorn main:app --reload --port 7002

# Terminal 2: Frontend
cd frontend && npm run dev
# http://localhost:5200 접속
```

---

## 8. Demo

<div align="center">

https://github.com/user-attachments/assets/e1d4e55a-a5ba-4442-8f72-214e3daa87ae

  <p><i>ANTenna 시연 영상</i></p>
</div>

---

## 9. Key Implementation Highlights

### 1. 효율적인 데이터 처리
- Pandas를 활용한 대용량 CSV 데이터 처리
- 이동평균선(MA20, MA240) 실시간 계산
- React Query 캐싱으로 불필요한 API 호출 최소화

### 2. 사용자 경험 최적화
- 3단계 정렬 시스템 (내림차순 → 오름차순 → 해제)
- 반응형 디자인 (모바일/데스크톱 지원)
- 실시간 자동완성 검색

### 3. 확장 가능한 아키텍처
- 라우터/서비스 분리로 모듈화된 백엔드 구조
- 커스텀 훅을 통한 재사용 가능한 데이터 로직
- TypeScript를 통한 타입 안정성 확보

### 4. 개인화 기능
- IP 기반 사용자 식별 (로그인 없이 개인 데이터 유지)
- 폴더별 즐겨찾기 관리
- 종목별 메모 기능

---

## 10. Future Improvements

- [ ] 소셜 로그인 연동
- [ ] 다크/라이트 테마 전환
- [ ] 머신러닝 · 딥러닝 · 강화학습을 활용한 AI 퀀트 전략 시스템 구축

---

## 11. License

All rights and intellectual property regarding this project belong exclusively to the owner of the account: [sangpiri1107@gmail.com]. Unauthorized copying, modification, or distribution is strictly prohibited.

이 프로젝트에 관한 모든 권리와 지적 재산권은 오직 [sangpiri1107@gmail.com] 계정 소유자에게 귀속됩니다. 무단 복제, 수정 또는 배포는 엄격히 금지됩니다.

---

<div align="center">
  <p>Made with React + FastAPI</p>
</div>

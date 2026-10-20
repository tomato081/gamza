# 🥔 감자 (Gamza) - 따뜻한 동네 중고거래 웹 서비스

이웃과 함께 따뜻한 온기를 나누는 중고거래 웹 플랫폼 **감자(Gamza)**입니다.

![Gamza Preview](https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=1200&auto=format&fit=crop&q=80)

---

## ✨ 주요 기능

- **이웃 인증 및 회원 관리 (Supabase Auth)**
  - 이메일/비밀번호 기반 회원가입 및 로그인
  - 닉네임 및 거래 희망 동네 프로필 설정
- **실시간 중고 거래 물품 목록**
  - 카드형 UI로 최신 등록 상품 및 판매자 닉네임 실시간 탐색
  - 카테고리별 필터링 (디지털기기, 가구/인테리어, 의류, 식품, 도서 등)
  - **'거래 가능만 보기'** 토글 필터 (거래 완료 상품 제외)
  - 실시간 검색어 검색 기능
  - 거래 완료 상품 흐림(Dimmed) 처리로 직관적인 상태 구분
- **게시글 상세 보기**
  - 상품 사진, 가격(나눔 표시), 판매 위치, 작성 시간, 상세 설명
  - 판매자 프로필 및 매너온도 확인
  - 관심 상품(찜) 토글 및 상태 유지
- **작성자 전용 관리 기능**
  - 자신이 작성한 글 클릭 시 **[판매중]**, **[예약중]**, **[거래 완료]** 원클릭 상태 전환
  - 상태 변경 시 데이터베이스 실시간 저장 및 목록 카드 배지 동기화
  - 게시글 수정 및 삭제 기능
- **간편한 물품 등록**
  - 직관적인 상품 정보 입력 모달
  - 로컬 이미지 업로드 및 샘플 칩 / 이미지 URL 지원

---

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3 (Custom Responsive Layout), Vanilla JavaScript (ES6+)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Supabase Auth, Row Level Security)
- **Local Server**: Node.js HTTP Server

---

## 🚀 로컬 실행 방법

별도의 복잡한 빌드 과정 없이 정적 웹 호스팅 환경에서 바로 실행할 수 있습니다.

```bash
# 로컬 개발 서버 실행
node server.js
```

브라우저에서 `http://localhost:3000`으로 접속하여 서비스를 확인할 수 있습니다.

---

## 📄 라이선스

This project is licensed under the MIT License.

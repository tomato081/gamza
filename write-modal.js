/**
 * ==========================================================================
 * [화면 3] 감자(Gamza) 글쓰기 모달 제어 & 신규 상품 생성 스크립트
 * ==========================================================================
 */

(function (window, document) {
  'use strict';

  // 샘플 이미지 사전 (기본 제공)
  const SAMPLE_IMAGES = {
    potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
    laptop: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
    chair: 'https://images.unsplash.com/photo-1580481077195-c3f915f01908?auto=format&fit=crop&w=600&q=80',
    headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80'
  };

  const DEFAULT_POTATO_IMG = SAMPLE_IMAGES.potato;

  class GamzaWriteModal {
    /**
     * @param {Object} options
     * @param {Array} [options.products] - 전역 상품 목록 배열 참조 (지정 시 unshift 수행)
     * @param {Function} [options.onProductAdded] - 새 상품 등록 후 호출될 콜백 함수 (re-render 등)
     * @param {string|HTMLElement} [options.openTrigger] - 모달을 열 트리거 버튼 셀렉터 또는 엘리먼트
     */
    constructor(options = {}) {
      this.products = options.products || (window.GamzaProductList && window.GamzaProductList.state ? window.GamzaProductList.state.products : (window.gamzaProducts || []));
      this.onProductAdded = options.onProductAdded || null;
      this.openTrigger = options.openTrigger || '#gamza-btn-write, #openWriteModalBtn';

      this.currentImageData = ''; // 현재 선택/입력된 이미지 (DataURL 또는 웹 URL)

      this.initElements();
      this.bindEvents();
      this.setupGlobalHooks();
    }

    initElements() {
      // 모달 루트
      this.overlay = document.getElementById('writeModalOverlay');
      this.closeBtn = document.getElementById('closeWriteModalBtn');
      this.cancelBtn = document.getElementById('cancelWriteBtn');
      this.submitBtn = document.getElementById('submitWriteBtn');
      this.form = document.getElementById('writeProductForm');

      // 폼 필드
      this.titleInput = document.getElementById('productTitle');
      this.categorySelect = document.getElementById('productCategory');
      this.priceInput = document.getElementById('productPrice');
      this.freeSharingCheck = document.getElementById('freeSharingCheck');
      this.priceFormattedGuide = document.getElementById('priceFormattedGuide');
      this.priceKoreanFormat = document.getElementById('priceKoreanFormat');
      this.locationInput = document.getElementById('productLocation');
      this.descTextarea = document.getElementById('productDescription');
      this.currentDescLen = document.getElementById('currentDescLen');

      // 이미지 요소
      this.fileInput = document.getElementById('productImageFile');
      this.urlInput = document.getElementById('productImageUrl');
      this.applyUrlBtn = document.getElementById('applyImageUrlBtn');
      this.imagePreview = document.getElementById('imagePreview');
      this.imagePlaceholder = document.getElementById('imagePlaceholder');
      this.removeImageBtn = document.getElementById('removeImageBtn');

      // 에러 피드백
      this.feedback = {
        title: document.getElementById('titleFeedback'),
        category: document.getElementById('categoryFeedback'),
        price: document.getElementById('priceFeedback'),
        location: document.getElementById('locationFeedback'),
        description: document.getElementById('descriptionFeedback')
      };
    }

    bindEvents() {
      // 헤더 [글쓰기] 버튼 연결
      if (typeof this.openTrigger === 'string') {
        const triggerEl = document.querySelector(this.openTrigger);
        if (triggerEl) {
          triggerEl.addEventListener('click', () => this.open());
        }
      } else if (this.openTrigger instanceof HTMLElement) {
        this.openTrigger.addEventListener('click', () => this.open());
      }

      // 모달 닫기 버튼들
      if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
      if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.close());

      // 모달 배경 클릭 시 닫기
      if (this.overlay) {
        this.overlay.addEventListener('click', (e) => {
          if (e.target === this.overlay) {
            this.close();
          }
        });
      }

      // ESC 키로 닫기
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          this.close();
        }
      });

      // 이미지 파일 업로드 (FileReader)
      if (this.fileInput) {
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
      }

      // 이미지 URL 적용 버튼
      if (this.applyUrlBtn) {
        this.applyUrlBtn.addEventListener('click', () => this.handleUrlApply());
      }
      if (this.urlInput) {
        this.urlInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleUrlApply();
          }
        });
      }

      // 샘플 이미지 칩 클릭
      document.querySelectorAll('.btn-chip[data-sample]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sampleKey = btn.dataset.sample;
          if (SAMPLE_IMAGES[sampleKey]) {
            this.setImage(SAMPLE_IMAGES[sampleKey]);
            if (this.urlInput) this.urlInput.value = SAMPLE_IMAGES[sampleKey];
          }
        });
      });

      // 이미지 삭제 버튼
      if (this.removeImageBtn) {
        this.removeImageBtn.addEventListener('click', () => this.resetImage());
      }

      // 가격 입력 포맷팅
      if (this.priceInput) {
        this.priceInput.addEventListener('input', (e) => this.handlePriceInput(e));
      }

      // 무료 나눔 체크박스
      if (this.freeSharingCheck) {
        this.freeSharingCheck.addEventListener('change', () => this.handleFreeSharingToggle());
      }

      // 동네 빠른 선택 칩
      document.querySelectorAll('.btn-location-chip[data-loc]').forEach((chip) => {
        chip.addEventListener('click', () => {
          if (this.locationInput) {
            this.locationInput.value = chip.dataset.loc;
            this.clearFieldError('location');
          }
        });
      });

      // 내 동네 찾기 (Mock/Geolocation)
      const myLocationBtn = document.getElementById('myLocationBtn');
      if (myLocationBtn) {
        myLocationBtn.addEventListener('click', () => this.findMyLocation());
      }

      // 상세설명 글자수 카운트 & 자동 조절
      if (this.descTextarea) {
        this.descTextarea.addEventListener('input', () => {
          const len = this.descTextarea.value.length;
          if (this.currentDescLen) this.currentDescLen.textContent = len;
          if (len > 0) this.clearFieldError('description');
        });
      }

      // 필드 실시간 에러 클리어
      if (this.titleInput) {
        this.titleInput.addEventListener('input', () => {
          if (this.titleInput.value.trim().length >= 2) this.clearFieldError('title');
        });
      }
      if (this.categorySelect) {
        this.categorySelect.addEventListener('change', () => {
          if (this.categorySelect.value) this.clearFieldError('category');
        });
      }

      // 작성 완료 제출
      if (this.submitBtn) {
        this.submitBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleSubmit();
        });
      }
    }

    /* ----------------------------------------------------------------------
       모달 열기 / 닫기
    ---------------------------------------------------------------------- */
    open() {
      if (!this.overlay) return;
      this.overlay.classList.add('is-open');
      this.overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden'; // 배경 스크롤 방지

      // 기본 이미지 미선택 시 기본 감자 이미지 추천 세팅 (또는 빈 상태)
      if (!this.currentImageData) {
        this.setImage(DEFAULT_POTATO_IMG);
      }

      // 첫 번째 인풋으로 포커스
      setTimeout(() => {
        if (this.titleInput) this.titleInput.focus();
      }, 150);
    }

    close() {
      if (!this.overlay) return;
      this.overlay.classList.remove('is-open');
      this.overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      this.resetForm();
    }

    isOpen() {
      return this.overlay && this.overlay.classList.contains('is-open');
    }

    /* ----------------------------------------------------------------------
       이미지 처리 로직
    ---------------------------------------------------------------------- */
    handleFileUpload(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('이미지 파일(jpg, png, webp 등)만 업로드할 수 있습니다.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const resultUrl = e.target.result;
        this.setImage(resultUrl);
        if (this.urlInput) this.urlInput.value = ''; // URL 인풋 클리어
      };
      reader.readAsDataURL(file);
    }

    handleUrlApply() {
      const url = this.urlInput ? this.urlInput.value.trim() : '';
      if (!url) {
        alert('이미지 URL을 입력해주세요.');
        return;
      }
      this.setImage(url);
    }

    setImage(src) {
      this.currentImageData = src;
      if (this.imagePreview) {
        this.imagePreview.src = src;
        this.imagePreview.classList.remove('hidden');
      }
      if (this.imagePlaceholder) {
        this.imagePlaceholder.classList.add('hidden');
      }
      if (this.removeImageBtn) {
        this.removeImageBtn.classList.remove('hidden');
      }
    }

    resetImage() {
      this.currentImageData = '';
      if (this.fileInput) this.fileInput.value = '';
      if (this.urlInput) this.urlInput.value = '';
      if (this.imagePreview) {
        this.imagePreview.src = '';
        this.imagePreview.classList.add('hidden');
      }
      if (this.imagePlaceholder) {
        this.imagePlaceholder.classList.remove('hidden');
      }
      if (this.removeImageBtn) {
        this.removeImageBtn.classList.add('hidden');
      }
    }

    /* ----------------------------------------------------------------------
       가격 포맷팅 & 무료 나눔
    ---------------------------------------------------------------------- */
    handlePriceInput(e) {
      // 숫자 이외 문자 제거
      let rawVal = e.target.value.replace(/[^0-9]/g, '');
      if (rawVal === '') {
        e.target.value = '';
        if (this.priceKoreanFormat) this.priceKoreanFormat.textContent = '0원';
        return;
      }

      const numVal = parseInt(rawVal, 10);
      e.target.value = numVal.toLocaleString('ko-KR');

      if (this.priceKoreanFormat) {
        this.priceKoreanFormat.textContent = this.formatKoreanWon(numVal);
      }
      this.clearFieldError('price');
    }

    formatKoreanWon(num) {
      if (num === 0) return '0원 (무료 나눔)';
      if (num >= 100000000) {
        const uk = Math.floor(num / 100000000);
        const man = Math.floor((num % 100000000) / 10000);
        return `${uk}억 ${man > 0 ? man.toLocaleString() + '만 ' : ''}원`;
      }
      if (num >= 10000) {
        const man = Math.floor(num / 10000);
        const remainder = num % 10000;
        return `${man.toLocaleString()}만 ${remainder > 0 ? remainder.toLocaleString() : ''}원`;
      }
      return `${num.toLocaleString()}원`;
    }

    handleFreeSharingToggle() {
      const isFree = this.freeSharingCheck.checked;
      if (isFree) {
        this.priceInput.value = '0';
        this.priceInput.disabled = true;
        if (this.priceKoreanFormat) this.priceKoreanFormat.textContent = '0원 (따뜻한 감자 나눔 🥔)';
        this.clearFieldError('price');
      } else {
        this.priceInput.disabled = false;
        this.priceInput.value = '';
        if (this.priceKoreanFormat) this.priceKoreanFormat.textContent = '0원';
        this.priceInput.focus();
      }
    }

    /* ----------------------------------------------------------------------
       동네 위치 찾기 (간이 Mock / Geolocation 지원)
    ---------------------------------------------------------------------- */
    findMyLocation() {
      if (this.locationInput) {
        this.locationInput.placeholder = '현재 위치 찾는 중...';
      }
      setTimeout(() => {
        const defaultLocs = ['역삼1동', '강남구 역삼2동', '서초구 양재동', '춘천시 효자동'];
        const randomLoc = defaultLocs[Math.floor(Math.random() * defaultLocs.length)];
        if (this.locationInput) {
          this.locationInput.value = randomLoc;
          this.locationInput.placeholder = '예: 역삼1동, 강원도 춘천시 효자동';
          this.clearFieldError('location');
        }
      }, 350);
    }

    /* ----------------------------------------------------------------------
       유효성 검사 (Validation)
    ---------------------------------------------------------------------- */
    showFieldError(fieldKey, message, targetElement) {
      const fb = this.feedback[fieldKey];
      if (fb) {
        fb.textContent = message;
        fb.classList.add('has-error');
      }
      if (targetElement) {
        targetElement.classList.add('is-invalid');
      }
    }

    clearFieldError(fieldKey) {
      const fb = this.feedback[fieldKey];
      if (fb) {
        fb.textContent = '';
        fb.classList.remove('has-error');
      }
      const elMap = {
        title: this.titleInput,
        category: this.categorySelect,
        price: this.priceInput,
        location: this.locationInput,
        description: this.descTextarea
      };
      if (elMap[fieldKey]) {
        elMap[fieldKey].classList.remove('is-invalid');
      }
    }

    validateForm() {
      let isValid = true;
      let firstInvalidEl = null;

      // 1. 상품명 검사
      const title = this.titleInput.value.trim();
      if (!title) {
        this.showFieldError('title', '상품명을 입력해주세요.', this.titleInput);
        isValid = false;
        if (!firstInvalidEl) firstInvalidEl = this.titleInput;
      } else if (title.length < 2) {
        this.showFieldError('title', '상품명은 2자 이상 입력해주세요.', this.titleInput);
        isValid = false;
        if (!firstInvalidEl) firstInvalidEl = this.titleInput;
      } else {
        this.clearFieldError('title');
      }

      // 2. 카테고리 검사
      const category = this.categorySelect.value;
      if (!category) {
        this.showFieldError('category', '카테고리를 선택해주세요.', this.categorySelect);
        isValid = false;
        if (!firstInvalidEl) firstInvalidEl = this.categorySelect;
      } else {
        this.clearFieldError('category');
      }

      // 3. 가격 검사
      const isFree = this.freeSharingCheck && this.freeSharingCheck.checked;
      const rawPrice = this.priceInput.value.replace(/[^0-9]/g, '');
      if (!isFree && rawPrice === '') {
        this.showFieldError('price', '판매 가격을 입력해주세요 (무료 나눔은 체크)', this.priceInput);
        isValid = false;
        if (!firstInvalidEl) firstInvalidEl = this.priceInput;
      } else {
        this.clearFieldError('price');
      }

      // 4. 거래 동네 검사
      const location = this.locationInput.value.trim();
      if (!location) {
        this.showFieldError('location', '거래하실 동네를 입력해주세요.', this.locationInput);
        isValid = false;
        if (!firstInvalidEl) firstInvalidEl = this.locationInput;
      } else {
        this.clearFieldError('location');
      }

      // 5. 설명 검사
      const desc = this.descTextarea.value.trim();
      if (!desc) {
        this.showFieldError('description', '상품에 대한 설명을 입력해주세요.', this.descTextarea);
        isValid = false;
        if (!firstInvalidEl) firstInvalidEl = this.descTextarea;
      } else if (desc.length < 5) {
        this.showFieldError('description', '설명은 최소 5자 이상 적어주셔야 따뜻한 거래가 이루어져요.', this.descTextarea);
        isValid = false;
        if (!firstInvalidEl) firstInvalidEl = this.descTextarea;
      } else {
        this.clearFieldError('description');
      }

      if (firstInvalidEl) {
        firstInvalidEl.focus();
      }

      return isValid;
    }

    /* ----------------------------------------------------------------------
       폼 제출 & 새 상품 객체 생성
    ---------------------------------------------------------------------- */
    handleSubmit() {
      if (!this.validateForm()) {
        return;
      }

      // 상태 라디오 값 추출
      const statusRadio = document.querySelector('input[name="status"]:checked');
      const statusValue = statusRadio ? statusRadio.value : '판매중';

      // 가격 계산
      const isFree = this.freeSharingCheck && this.freeSharingCheck.checked;
      const numericPrice = isFree ? 0 : parseInt(this.priceInput.value.replace(/[^0-9]/g, ''), 10);
      const displayPrice = isFree ? '나눔 🥔' : `${numericPrice.toLocaleString('ko-KR')}원`;

      // 최종 이미지: 등록된 것이 없으면 기본 감자 이미지 적용
      const finalImage = this.currentImageData || DEFAULT_POTATO_IMG;

      // 신규 상품 객체 생성 (Gamza 표준 데이터 스키마)
      const newProduct = {
        id: 'gamza_' + Date.now(),
        title: this.titleInput.value.trim(),
        category: this.categorySelect.value,
        price: numericPrice,
        formattedPrice: displayPrice,
        location: this.locationInput.value.trim(),
        status: statusValue,
        imageUrl: finalImage,
        description: this.descTextarea.value.trim(),
        createdAt: new Date().toISOString(),
        createdAgo: '방금 전',
        likes: 0,
        chats: 0,
        seller: {
          name: '감자농부',
          rating: 36.5,
          avatar: '🥔'
        }
      };

      // 1. 상품 배열 맨 앞에 추가 (unshift)
      if (window.GamzaProductList && typeof window.GamzaProductList.addProduct === 'function') {
        window.GamzaProductList.addProduct({
          title: newProduct.title,
          category: newProduct.category,
          price: newProduct.price,
          status: newProduct.status,
          location: newProduct.location,
          timeAgo: '방금 전',
          imageUrl: newProduct.imageUrl,
          description: newProduct.description
        });
      } else {
        if (Array.isArray(this.products)) {
          this.products.unshift(newProduct);
        }
        if (Array.isArray(window.gamzaProducts) && window.gamzaProducts !== this.products) {
          window.gamzaProducts.unshift(newProduct);
        }
      }

      // 2. 커스텀 이벤트 발행 (다른 컴포넌트 및 메인 목록이 감지하여 즉시 렌더링하도록)
      const event = new CustomEvent('gamza:product-created', {
        bubbles: true,
        detail: {
          product: newProduct,
          products: this.products
        }
      });
      document.dispatchEvent(event);
      window.dispatchEvent(event);

      // 3. 콜백 함수 호출 (옵션으로 지정된 경우)
      if (typeof this.onProductAdded === 'function') {
        this.onProductAdded(newProduct, this.products);
      }

      // 4. 모달 닫기 및 폼 초기화
      this.close();

      // 5. 완료 알림 (부드러운 피드백)
      this.showToast('새로운 감자가 분양 목록에 등록되었습니다! 🥔✨');
    }

    /* ----------------------------------------------------------------------
       전역 훅 연동 (다른 화면/모듈과의 완벽한 호환성)
    ---------------------------------------------------------------------- */
    setupGlobalHooks() {
      // 1. window.openProductWriteModal 함수 연결
      window.openProductWriteModal = () => this.open();

      // 2. gamza:openProductWrite 커스텀 이벤트 수신 시 오픈
      window.addEventListener('gamza:openProductWrite', () => this.open());
    }

    /* ----------------------------------------------------------------------
       폼 리셋
    ---------------------------------------------------------------------- */
    resetForm() {
      if (this.form) this.form.reset();
      this.resetImage();
      if (this.currentDescLen) this.currentDescLen.textContent = '0';
      if (this.priceKoreanFormat) this.priceKoreanFormat.textContent = '0원';
      if (this.priceInput) this.priceInput.disabled = false;
      if (this.locationInput) this.locationInput.value = '역삼1동';

      // 에러 메시지 모두 삭제
      Object.keys(this.feedback).forEach((key) => this.clearFieldError(key));
    }

    /* ----------------------------------------------------------------------
       간이 토스트 알림
    ---------------------------------------------------------------------- */
    showToast(message) {
      let toast = document.getElementById('gamzaToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'gamzaToast';
        toast.style.cssText = `
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(50px);
          background: #945214;
          color: #FFF;
          padding: 12px 24px;
          border-radius: 9999px;
          font-size: 0.95rem;
          font-weight: 600;
          box-shadow: 0 8px 20px rgba(148,82,20,0.3);
          z-index: 9999;
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
        `;
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(50px)';
      }, 2500);
    }
  }

  // 전역 노출 및 자동 초기화 지원
  window.GamzaWriteModal = GamzaWriteModal;

  // DOM 로드 완료 시 전역 인스턴스 자동 연동 (편의성)
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.gamzaWriteModalInstance && document.getElementById('writeModalOverlay')) {
      window.gamzaWriteModalInstance = new GamzaWriteModal();
    }
  });

})(window, document);

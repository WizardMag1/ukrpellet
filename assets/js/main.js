/**
 * IA-TEMS & UkrPellet — Main Application Scripts
 * Mobile navigation, modal dialogues, toast feedback, form submission, ad tracking
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
      mobileToggle.setAttribute('aria-expanded', !isExpanded);
      navMenu.classList.toggle('open');
    });

    // Close mobile menu on nav link click
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // 2. Header shadow on scroll
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }, { passive: true });

  // 3. Modal Dialog Controller
  const contactModal = document.getElementById('contact-dialog');
  const openModalBtns = document.querySelectorAll('[data-open-modal]');
  const closeModalBtns = document.querySelectorAll('[data-close-modal]');

  openModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (contactModal && typeof contactModal.showModal === 'function') {
        contactModal.showModal();
      }
    });
  });

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (contactModal) {
        contactModal.close();
      }
    });
  });

  // Close modal when clicking outside on the backdrop
  if (contactModal) {
    contactModal.addEventListener('click', (e) => {
      const rect = contactModal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        contactModal.close();
      }
    });
  }

  // 4. Form Handling with API Integration & Ad Tracking
  const leadForms = document.querySelectorAll('.quote-lead-form');
  const toastMsg = document.getElementById('toast-notification');

  function showToast(message) {
    if (!toastMsg) return;
    const textSpan = toastMsg.querySelector('.toast-text');
    if (textSpan) textSpan.textContent = message;
    toastMsg.classList.add('show');
    setTimeout(() => {
      toastMsg.classList.remove('show');
    }, 5000);
  }

  leadForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = form.querySelector('input[name="name"]');
      const phoneInput = form.querySelector('input[name="phone"]');
      const emailInput = form.querySelector('input[name="email"]');
      const cityInput = form.querySelector('input[name="city"]');
      const volumeInput = form.querySelector('input[name="volume"]');
      const commentInput = form.querySelector('textarea[name="comment"]');

      if (phoneInput && !phoneInput.value.trim()) {
        phoneInput.focus();
        return;
      }

      const utmData = typeof window.getSavedUtm === 'function' ? window.getSavedUtm() : {};

      const payload = {
        name: nameInput?.value?.trim() || '',
        phone: phoneInput?.value?.trim() || '',
        email: emailInput?.value?.trim() || '',
        city: cityInput?.value?.trim() || '',
        volume: volumeInput?.value?.trim() || '',
        comment: commentInput?.value?.trim() || '',
        ...utmData
      };

      // Fire Meta Pixel & Google Analytics Lead Conversion Event
      if (typeof window.trackAdEvent === 'function') {
        window.trackAdEvent('Lead', {
          content_name: 'Wood Pellets Wholesale Inquiry',
          content_category: 'Biofuel B2B',
          city: payload.city,
          volume: payload.volume,
          currency: 'UAH',
          value: 75000 // Sample nominal order value for 15 tons
        });
      }

      // Close modal if open
      if (contactModal && contactModal.open) {
        contactModal.close();
      }

      // Reset inputs
      form.reset();

      // Show instant feedback toast
      const lang = localStorage.getItem('site_lang') || 'uk';
      const successMessage = lang === 'uk'
        ? "Дякуємо! Ваша заявка прийнята. Менеджер зв'яжеться з вами протягом 15 хвилин."
        : "Thank you! Your quote request has been received. Our sales manager will contact you within 15 minutes.";

      showToast(successMessage);

      // Open Telegram with pre-filled lead summary (popup to your number)
      const contacts = window.APP_CONFIG?.CONTACTS;
      const tgUrl = contacts?.telegram_url || 'https://t.me/+380664035396';
      const leadMsg = [
        '🟢 Нова B2B заявка з сайту',
        `👤 Ім'я: ${payload.name || '—'}`,
        `📞 Телефон: ${payload.phone}`,
        payload.email ? `✉️ Email: ${payload.email}` : '',
        payload.city ? `📍 Місто: ${payload.city}` : '',
        payload.volume ? `⚖️ Об'єм: ${payload.volume}` : '',
        payload.comment ? `💬 Коментар: ${payload.comment}` : '',
        utmData.utm_source ? `📊 UTM: ${utmData.utm_source} / ${utmData.utm_campaign || '—'}` : ''
      ].filter(Boolean).join('\n');
      const tgDeepLink = `${tgUrl}?text=${encodeURIComponent(leadMsg)}`;
      window.open(tgDeepLink, '_blank');

      // Submit to backend API (/api/lead) asynchronously
      try {
        await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        // Fail silently on static previews
        console.log('[Lead Submission Note] Static environment fallback', err);
      }
    });
  });
});

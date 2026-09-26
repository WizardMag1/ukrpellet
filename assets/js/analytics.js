/**
 * UkrEcoPelleta & ТОВ «УКРЕКОПЕЛЕТА» — Ad Tracking & UTM Attribution Engine
 * Supports: Meta Pixel (Facebook & Instagram), Google Analytics 4, Google Ads Conversions, UTM Capture
 */

(function () {
  // 1. Capture and persist UTM tags and Ad Click IDs (fbclid, gclid)
  function captureUtmParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    const utmData = {};

    trackingKeys.forEach(key => {
      const val = urlParams.get(key);
      if (val) {
        utmData[key] = val;
        sessionStorage.setItem('ad_' + key, val);
      } else {
        const stored = sessionStorage.getItem('ad_' + key);
        if (stored) utmData[key] = stored;
      }
    });

    return utmData;
  }

  window.getSavedUtm = function () {
    return {
      utm_source: sessionStorage.getItem('ad_utm_source') || 'direct',
      utm_medium: sessionStorage.getItem('ad_utm_medium') || 'none',
      utm_campaign: sessionStorage.getItem('ad_utm_campaign') || 'none',
      utm_term: sessionStorage.getItem('ad_utm_term') || '',
      utm_content: sessionStorage.getItem('ad_utm_content') || '',
      fbclid: sessionStorage.getItem('ad_fbclid') || '',
      gclid: sessionStorage.getItem('ad_gclid') || ''
    };
  };

  captureUtmParams();

  const config = window.APP_CONFIG || {};

  // 2. Initialize Meta Pixel (Facebook & Instagram)
  if (config.META_PIXEL_ID && config.META_PIXEL_ID !== 'YOUR_META_PIXEL_ID') {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    
    fbq('init', config.META_PIXEL_ID);
    fbq('track', 'PageView');
    console.log('[Analytics] Meta Pixel Initialized:', config.META_PIXEL_ID);
  }

  // 3. Initialize Google Analytics 4 & Google Ads Conversion Tracking
  const googleTrackingId = config.GA4_MEASUREMENT_ID || config.GOOGLE_ADS_CONVERSION_ID;
  if (googleTrackingId && !googleTrackingId.includes('XXXXX')) {
    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleTrackingId}`;
    document.head.appendChild(gaScript);

    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());

    if (config.GA4_MEASUREMENT_ID && !config.GA4_MEASUREMENT_ID.includes('XXXXX')) {
      gtag('config', config.GA4_MEASUREMENT_ID);
      console.log('[Analytics] Google Analytics 4 Initialized:', config.GA4_MEASUREMENT_ID);
    }

    if (config.GOOGLE_ADS_CONVERSION_ID && !config.GOOGLE_ADS_CONVERSION_ID.includes('XXXXX')) {
      gtag('config', config.GOOGLE_ADS_CONVERSION_ID);
      console.log('[Analytics] Google Ads Tracking Initialized:', config.GOOGLE_ADS_CONVERSION_ID);
    }
  }

  // 4. Universal Ad Event Dispatcher
  window.trackAdEvent = function (eventName, eventParams = {}) {
    console.log('%c[Ad Event Triggered] ' + eventName, 'background: #1e5631; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 3px;', eventParams);

    // Meta Pixel Event
    if (typeof window.fbq === 'function') {
      window.fbq('track', eventName, eventParams);
    }

    // Google Tag & Google Ads Conversion Event
    if (typeof window.gtag === 'function') {
      if (eventName === 'Lead') {
        // Standard GA4 event
        window.gtag('event', 'generate_lead', {
          currency: eventParams.currency || 'UAH',
          value: eventParams.value || 75000,
          ...eventParams
        });

        // Specific Google Ads Conversion action if configured
        if (config.GOOGLE_ADS_CONVERSION_ID && config.GOOGLE_ADS_CONVERSION_LABEL) {
          const sendToId = `${config.GOOGLE_ADS_CONVERSION_ID}/${config.GOOGLE_ADS_CONVERSION_LABEL}`;
          window.gtag('event', 'conversion', {
            'send_to': sendToId,
            'value': eventParams.value || 75000,
            'currency': eventParams.currency || 'UAH'
          });
          console.log('[Google Ads] Sent conversion to:', sendToId);
        }
      } else {
        window.gtag('event', eventName, eventParams);
      }
    }
  };

  // 5. Test Diagnostic Helper (for user to test if Google Ads works)
  window.testAdConversion = function () {
    console.log('%c=== Ad Tracking Diagnostics ===', 'color: #22c55e; font-weight: bold; font-size: 14px;');
    console.log('1. Meta Pixel (fbq):', typeof window.fbq === 'function' ? '✅ Loaded' : '⚠️ Not loaded (set META_PIXEL_ID in analytics-config.js)');
    console.log('2. Google gtag():', typeof window.gtag === 'function' ? '✅ Loaded' : '⚠️ Not loaded (set GA4_MEASUREMENT_ID or GOOGLE_ADS_CONVERSION_ID)');
    console.log('3. Stored UTM:', window.getSavedUtm());
    console.log('4. Firing test Lead event now...');
    window.trackAdEvent('Lead', {
      content_name: 'Diagnostic Test Lead',
      city: 'м. Дніпро',
      tons: 15,
      currency: 'UAH',
      value: 75000
    });
    console.log('=== Test Complete. Check Network Tab or Tag Assistant ===');
  };

  // 6. Automatic Event Bindings
  document.addEventListener('DOMContentLoaded', () => {
    // Phone click
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
      link.addEventListener('click', () => {
        window.trackAdEvent('Contact', { channel: 'phone', target: link.href });
      });
    });

    // Telegram click
    document.querySelectorAll('a[href*="t.me"]').forEach(link => {
      link.addEventListener('click', () => {
        window.trackAdEvent('Contact', { channel: 'telegram', target: link.href });
      });
    });

    // Viber click
    document.querySelectorAll('a[href*="viber:"]').forEach(link => {
      link.addEventListener('click', () => {
        window.trackAdEvent('Contact', { channel: 'viber', target: link.href });
      });
    });

    // Calculator interaction
    const calcSlider = document.getElementById('calc-tons-slider');
    if (calcSlider) {
      let calcTimer;
      calcSlider.addEventListener('change', (e) => {
        clearTimeout(calcTimer);
        calcTimer = setTimeout(() => {
          window.trackAdEvent('CustomizeProduct', {
            content_name: 'Pellet Calculator',
            tons: e.target.value,
            category: 'Wood Pellets Wholesale'
          });
        }, 500);
      });
    }

    console.log('%c[UkrEcoPelleta Ads]%c Tracking engine ready. Run %cwindow.testAdConversion()%c to test.', 
      'color: #22c55e; font-weight: bold;', 
      'color: inherit;', 
      'color: #0284c7; font-weight: bold;', 
      'color: inherit;'
    );
  });
})();

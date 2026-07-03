/**
 * GoHighLevel custom JS — contact profile button (multi-subaccount).
 *
 * Paste into GHL: Settings → Company → Custom JS/CSS (or subaccount custom code).
 * Works for every onboarded location — location_id is read from the GHL URL.
 * The button is shown only when /api/quote/account-info/ confirms the location is onboarded.
 *
 * Configure APP_BASE_URL to your deployed frontend origin (no trailing slash).
 */
(function () {
  'use strict';

  var APP_BASE_URL = 'https://snapshot.theservicepilot.com';
  var API_BASE_URL = APP_BASE_URL + '/api';
  var ONBOARD_CACHE_PREFIX = 'sp_location_onboarded_';
  var ONBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
  var TARGET_SELECTOR =
    '#record-details-new-ui > div > div > div > div.h-full.transition-all.duration-300.shrink-0.right-sidebar-container > div > nav > div.flex.flex-col.items-center.gap-2.rounded-lg';
  var BUTTON_ID = 'sp-contact-profile-button';
  var POPUP_ID = 'sp-contact-profile-popup';
  var onboardCheckToken = 0;

  function readOnboardCache(locationId) {
    try {
      var raw = sessionStorage.getItem(ONBOARD_CACHE_PREFIX + locationId);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || Date.now() - parsed.at > ONBOARD_CACHE_TTL_MS) return null;
      return !!parsed.onboarded;
    } catch (error) {
      return null;
    }
  }

  function writeOnboardCache(locationId, onboarded) {
    try {
      sessionStorage.setItem(
        ONBOARD_CACHE_PREFIX + locationId,
        JSON.stringify({ onboarded: !!onboarded, at: Date.now() })
      );
    } catch (error) {
      // ignore storage errors
    }
  }

  function isLocationOnboarded(locationId, callback) {
    if (!locationId) {
      callback(false);
      return;
    }

    var cached = readOnboardCache(locationId);
    if (cached !== null) {
      callback(cached);
      return;
    }

    var url =
      API_BASE_URL +
      '/quote/account-info/?location_id=' +
      encodeURIComponent(locationId);

    fetch(url, { method: 'GET', credentials: 'omit' })
      .then(function (response) {
        var onboarded = response.ok;
        writeOnboardCache(locationId, onboarded);
        callback(onboarded);
      })
      .catch(function () {
        writeOnboardCache(locationId, false);
        callback(false);
      });
  }

  function removeCustomButton() {
    var existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();
  }

  function extractLocationId() {
    var match = window.location.pathname.match(/\/location\/([^/]+)\//);
    return match ? match[1] : null;
  }

  function extractContactId() {
    var match = window.location.href.match(/\/contacts\/details?\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  function isContactDetailPage() {
    return /\/contacts\/details?\//.test(window.location.pathname) && !!extractLocationId();
  }

  function isTargetElementVisible() {
    var element = document.querySelector(TARGET_SELECTOR);
    if (!element) return false;
    var style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function closePopup() {
    var popup = document.getElementById(POPUP_ID);
    if (popup) popup.remove();
  }

  function buildProfileUrl(contactId, locationId) {
    return (
      APP_BASE_URL +
      '/contact/jobs/' +
      encodeURIComponent(contactId) +
      '?location_id=' +
      encodeURIComponent(locationId)
    );
  }

  function showPopup() {
    var contactId = extractContactId();
    var locationId = extractLocationId();

    if (!contactId || !locationId) {
      console.error('[ServicePilot] Missing contactId or locationId');
      return;
    }

    var popupUrl = buildProfileUrl(contactId, locationId);
    closePopup();

    var overlay = document.createElement('div');
    overlay.id = POPUP_ID;
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    var popup = document.createElement('div');
    popup.style.cssText =
      'position:relative;width:94%;max-width:1100px;height:92vh;background:#fff;border-radius:16px;box-shadow:0 24px 64px rgba(15,23,42,0.28);display:flex;flex-direction:column;overflow:hidden;';

    var header = document.createElement('div');
    header.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #e5e7eb;background:linear-gradient(90deg,#eff6ff,#f5f3ff);';

    var title = document.createElement('h2');
    title.textContent = 'Client profile';
    title.style.cssText = 'margin:0;font-size:18px;font-weight:700;color:#111827;';

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.style.cssText =
      'background:#fff;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;color:#6b7280;padding:8px;display:flex;align-items:center;justify-content:center;';
    closeBtn.addEventListener('click', closePopup);

    header.appendChild(title);
    header.appendChild(closeBtn);
    popup.appendChild(header);

    var iframeContainer = document.createElement('div');
    iframeContainer.style.cssText = 'flex:1;overflow:hidden;background:#f8fafc;';

    var iframe = document.createElement('iframe');
    iframe.src = popupUrl;
    iframe.title = 'ServicePilot client profile';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    iframe.setAttribute('allow', 'geolocation');

    iframeContainer.appendChild(iframe);
    popup.appendChild(iframeContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closePopup();
    });

    document.addEventListener('keydown', function handleEscape(event) {
      if (event.key === 'Escape') {
        closePopup();
        document.removeEventListener('keydown', handleEscape);
      }
    });
  }

  function addCustomButton() {
    if (document.getElementById(BUTTON_ID)) return;
    var targetElement = document.querySelector(TARGET_SELECTOR);
    if (!targetElement) return;

    var button = document.createElement('button');
    button.id = BUTTON_ID;
    button.setAttribute('title', 'Open client profile');
    button.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
    button.style.cssText =
      'width:40px;height:40px;border-radius:10px;border:2px solid transparent;background:transparent;color:#374151;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;padding:0;';
    button.onmouseover = function () {
      button.style.borderColor = '#dbeafe';
      button.style.color = '#2563eb';
      button.style.backgroundColor = '#fff';
    };
    button.onmouseout = function () {
      button.style.borderColor = 'transparent';
      button.style.color = '#374151';
      button.style.backgroundColor = 'transparent';
    };
    button.addEventListener('click', showPopup);
    targetElement.appendChild(button);
  }

  function checkAndAddButton() {
    if (!isContactDetailPage()) {
      removeCustomButton();
      return;
    }

    var locationId = extractLocationId();
    if (!locationId) {
      removeCustomButton();
      return;
    }

    var checkId = ++onboardCheckToken;
    isLocationOnboarded(locationId, function (onboarded) {
      if (checkId !== onboardCheckToken) return;

      if (!onboarded) {
        removeCustomButton();
        return;
      }

      if (isTargetElementVisible()) addCustomButton();
    });
  }

  function setupObserver() {
    checkAndAddButton();
    var observer = new MutationObserver(function () {
      clearTimeout(observer._t);
      observer._t = setTimeout(checkAndAddButton, 120);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    console.log('[ServicePilot] Contact profile button loaded (onboarded locations only)');
  }

  document.addEventListener('click', function (event) {
    if (isContactDetailPage() && !event.target.closest('#' + BUTTON_ID)) {
      checkAndAddButton();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObserver);
  } else {
    setupObserver();
  }
})();

/* DOC-FULL-NR V16.5 - Camera-only registration + Thai profile fields
   Loaded BEFORE app.js. No file/gallery picker is created anywhere. */
(() => {
  "use strict";

  const REGISTER_PATH = "/functions/v1/register-user";
  const CAMERA_REGISTER_PATH = "/functions/v1/register-user-camera";
  const state = { stream: null, photoDataUrl: null, activeForm: null };
  const nativeFetch = window.fetch.bind(window);

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      state.stream = null;
    }
  }

  function clearPhoto() {
    state.photoDataUrl = null;
  }

  function setMessage(root, text, kind = "") {
    const box = root?.querySelector("[data-camera-message]");
    if (!box) return;
    box.textContent = text || "";
    box.className = `camera-message ${kind}`.trim();
  }

  async function startCamera(root) {
    setMessage(root, "");
    clearPhoto();
    const preview = root.querySelector("[data-camera-photo]");
    const video = root.querySelector("[data-camera-video]");
    const shoot = root.querySelector("[data-camera-shoot]");
    const start = root.querySelector("[data-camera-start]");
    const retake = root.querySelector("[data-camera-retake]");
    const submit = document.querySelector("#signupbtn");
    if (submit) submit.disabled = true;
    preview.hidden = true;
    video.hidden = false;
    shoot.hidden = false;
    retake.hidden = true;
    start.hidden = true;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      video.hidden = true;
      shoot.hidden = true;
      start.hidden = false;
      setMessage(root, "อุปกรณ์/เบราว์เซอร์นี้ไม่อนุญาตการใช้กล้อง กรุณาเปิดลิงก์ด้วย Chrome, Safari, Samsung Internet หรือ Edge แล้วอนุญาตกล้อง", "error");
      return;
    }

    stopCamera();
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 }
        }
      });
      video.srcObject = state.stream;
      video.muted = true;
      video.setAttribute("playsinline", "");
      await video.play();
      setMessage(root, "จัดใบหน้าให้อยู่กึ่งกลาง แล้วกด “ถ่ายรูปโปรไฟล์”", "ok");
    } catch (error) {
      stopCamera();
      video.hidden = true;
      shoot.hidden = true;
      start.hidden = false;
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      setMessage(root, denied
        ? "ยังไม่ได้รับอนุญาตใช้กล้อง โปรดอนุญาต Camera ให้เว็บไซต์นี้ แล้วกดเปิดกล้องอีกครั้ง"
        : "ไม่สามารถเปิดกล้องได้ กรุณาตรวจว่ากล้องไม่ได้ถูกแอปอื่นใช้งานอยู่ แล้วลองใหม่", "error");
    }
  }

  function capturePhoto(root) {
    const video = root.querySelector("[data-camera-video]");
    const canvas = root.querySelector("[data-camera-canvas]");
    const preview = root.querySelector("[data-camera-photo]");
    if (!video.videoWidth || !video.videoHeight) {
      setMessage(root, "กล้องยังไม่พร้อม กรุณารอสักครู่แล้วกดถ่ายอีกครั้ง", "error");
      return;
    }

    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = Math.floor((video.videoWidth - side) / 2);
    const sy = Math.floor((video.videoHeight - side) / 2);
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 512, 512);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

    // Server accepts <=1 MB. 512x512 JPEG should be well below this,
    // but keep a client-side guard as well.
    if (dataUrl.length > 1_350_000) {
      setMessage(root, "รูปมีขนาดใหญ่เกินไป กรุณาถ่ายใหม่", "error");
      return;
    }

    state.photoDataUrl = dataUrl;
    preview.src = dataUrl;
    preview.hidden = false;
    video.hidden = true;
    root.querySelector("[data-camera-shoot]").hidden = true;
    root.querySelector("[data-camera-retake]").hidden = false;
    stopCamera();
    const submit = document.querySelector("#signupbtn");
    if (submit) submit.disabled = false;
    setMessage(root, "บันทึกรูปจากกล้องสดแล้ว หากต้องการเปลี่ยนให้กด “ถ่ายใหม่”", "success");
  }

  function decorateSignup(form) {
    if (!form || form.dataset.cameraReady === "1") return;
    form.dataset.cameraReady = "1";
    state.activeForm = form;
    clearPhoto();
    stopCamera();

    const submit = form.querySelector("#signupbtn");
    if (submit) submit.disabled = true;

    const cameraBlock = document.createElement("section");
    cameraBlock.className = "camera-registration-card";
    cameraBlock.setAttribute("data-camera-profile", "");
    cameraBlock.innerHTML = `
      <div class="camera-title-row">
        <div>
          <h3>📷 รูปโปรไฟล์นักศึกษา <span class="camera-required">*จำเป็น</span></h3>
          <div class="camera-subtitle">ต้องถ่ายจากกล้องสดในขณะลงทะเบียนเท่านั้น ไม่สามารถเลือกจากคลังรูปหรือไฟล์ในเครื่องได้</div>
        </div>
        <span class="camera-live-badge">LIVE CAMERA</span>
      </div>
      <div class="camera-stage">
        <video data-camera-video autoplay muted playsinline hidden></video>
        <img data-camera-photo alt="ตัวอย่างรูปโปรไฟล์จากกล้องสด" hidden>
        <div class="camera-guide" aria-hidden="true"></div>
      </div>
      <canvas data-camera-canvas hidden></canvas>
      <div class="camera-actions">
        <button type="button" class="btn primary" data-camera-start>เปิดกล้องหน้า</button>
        <button type="button" class="btn green" data-camera-shoot hidden>📸 ถ่ายรูปโปรไฟล์</button>
        <button type="button" class="btn" data-camera-retake hidden>↻ ถ่ายใหม่</button>
      </div>
      <div class="camera-message" data-camera-message>กรุณาถ่ายรูปโปรไฟล์ก่อนกดลงทะเบียน</div>
      <div class="camera-privacy">รูปจะเก็บใน Private Storage และใช้เป็นรูปโปรไฟล์ของบัญชีนี้</div>`;

    const grid = form.querySelector(".registration-grid");
    if (grid && !form.querySelector('[name="nickname"]')) {
      const nicknameField = document.createElement("div");
      nicknameField.className = "field";
      nicknameField.innerHTML = `<label>ชื่อเล่น <span class="camera-required">*จำเป็น</span></label><input name="nickname" placeholder="ชื่อเล่นภาษาไทย" maxlength="40" required><div class="field-help">ใช้ภาษาไทยเท่านั้น</div>`;
      const fullNameField = form.querySelector('[name="full_name"]')?.closest(".field");
      if (fullNameField) fullNameField.insertAdjacentElement("afterend", nicknameField);
      else grid.prepend(nicknameField);
    }
    if (grid && !form.querySelector('[name="phone"]')) {
      const phoneField = document.createElement("div");
      phoneField.className = "field";
      phoneField.innerHTML = `<label>เบอร์โทรศัพท์ <span class="camera-required">*จำเป็น</span></label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="เช่น 0812345678" pattern="(?:0[0-9]{9}|\+66[0-9]{9})" required><div class="field-help">บันทึกไว้เป็นข้อมูลติดต่อในโปรไฟล์นักศึกษา ไม่มีการส่ง OTP</div>`;
      grid.appendChild(phoneField);
    }
    if (grid?.parentNode) grid.insertAdjacentElement("afterend", cameraBlock);
    else form.prepend(cameraBlock);

    cameraBlock.querySelector("[data-camera-start]").addEventListener("click", () => startCamera(cameraBlock));
    cameraBlock.querySelector("[data-camera-shoot]").addEventListener("click", () => capturePhoto(cameraBlock));
    cameraBlock.querySelector("[data-camera-retake]").addEventListener("click", () => startCamera(cameraBlock));
  }

  // Enforce camera capture before the original app signup handler can run.
  document.addEventListener("submit", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "signup") return;
    if (!state.photoDataUrl) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const root = form.querySelector("[data-camera-profile]");
      setMessage(root, "ต้องถ่ายรูปโปรไฟล์จากกล้องสดก่อนลงทะเบียน", "error");
      root?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, true);

  // Intercept ONLY the self-registration Edge Function call. The original app
  // keeps all its existing validation/login behavior, while the request is
  // routed to the camera-required function and carries the live JPEG.
  window.fetch = async function(input, init) {
    const originalUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    if (!originalUrl || !originalUrl.includes(REGISTER_PATH) || originalUrl.includes(CAMERA_REGISTER_PATH)) {
      return nativeFetch(input, init);
    }

    if (!state.photoDataUrl) {
      return new Response(JSON.stringify({ error: "PROFILE_PHOTO_REQUIRED" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      let rawBody = init?.body;
      if (!rawBody && input instanceof Request) rawBody = await input.clone().text();
      const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : {};
      payload.profile_photo_jpeg = state.photoDataUrl;
      payload.profile_photo_source = "camera_live";
      payload.profile_photo_captured_at = new Date().toISOString();
      const phoneInput = state.activeForm?.querySelector('[name="phone"]');
      if (phoneInput) payload.phone = String(phoneInput.value || "").trim();
      const nicknameInput = state.activeForm?.querySelector('[name="nickname"]');
      if (nicknameInput) payload.nickname = String(nicknameInput.value || "").trim();
      const birthDateInput = state.activeForm?.querySelector('[name="birth_date"]');
      if (birthDateInput) payload.birth_date = String(birthDateInput.value || "").trim();

      const url = originalUrl.replace(REGISTER_PATH, CAMERA_REGISTER_PATH);
      if (input instanceof Request) {
        const headers = new Headers(input.headers);
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        return nativeFetch(url, {
          method: init?.method || input.method || "POST",
          headers,
          body: JSON.stringify(payload),
          credentials: init?.credentials || input.credentials,
          cache: init?.cache || input.cache,
          redirect: init?.redirect || input.redirect,
          referrer: init?.referrer || input.referrer,
          referrerPolicy: init?.referrerPolicy || input.referrerPolicy,
          signal: init?.signal || input.signal
        });
      }
      return nativeFetch(url, { ...init, body: JSON.stringify(payload) });
    } catch (error) {
      console.error("DOC-FULL-NR camera registration request error", error);
      return new Response(JSON.stringify({ error: "PROFILE_PHOTO_REQUEST_ERROR" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    .camera-registration-card{grid-column:1/-1;margin:16px 0;padding:16px;border:1px solid #dbe5f1;border-radius:18px;background:#f8fbff}
    .camera-title-row{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.camera-title-row h3{margin:0 0 4px;font-size:17px}.camera-subtitle{color:#5b6b80;font-size:13px;line-height:1.55}.camera-required{color:#dc2626;font-size:12px}.camera-live-badge{white-space:nowrap;padding:5px 9px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:800}
    .camera-stage{position:relative;width:min(100%,360px);aspect-ratio:1/1;margin:14px auto 10px;border-radius:22px;overflow:hidden;background:#111827;border:3px solid #e2e8f0}.camera-stage video,.camera-stage img{width:100%;height:100%;object-fit:cover;display:block}.camera-stage video{transform:scaleX(-1)}.camera-stage [hidden]{display:none!important}.camera-guide{pointer-events:none;position:absolute;inset:11%;border:2px dashed rgba(255,255,255,.7);border-radius:50%}
    .camera-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.camera-message{margin-top:10px;text-align:center;font-size:13px;color:#64748b}.camera-message.error{color:#b91c1c;font-weight:700}.camera-message.success{color:#15803d;font-weight:700}.camera-message.ok{color:#1d4ed8}.camera-privacy{text-align:center;color:#64748b;font-size:11px;margin-top:6px}
    @media(max-width:640px){.camera-registration-card{padding:12px;margin:12px 0}.camera-title-row{display:block}.camera-live-badge{display:inline-block;margin-top:8px}.camera-stage{width:min(100%,300px)}}`;
  document.head.appendChild(style);

  let observerTimer = null;
  const observer = new MutationObserver(() => {
    if (observerTimer) return;
    observerTimer = setTimeout(() => {
      observerTimer = null;
      const form = document.querySelector("#signup");
      if (form) decorateSignup(form);
      if (state.activeForm && !document.documentElement.contains(state.activeForm)) {
        stopCamera();
        clearPhoto();
        state.activeForm = null;
      }
    }, 60);
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  decorateSignup(document.querySelector("#signup"));

  window.addEventListener("pagehide", stopCamera);
})();

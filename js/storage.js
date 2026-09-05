/* ───────────────────────────────────────
   원탁토론 사진 리사이즈 + Firebase Storage 업로드.
   고칠 때 ─ 리사이즈 크기·화질을 바꾸려면 이 파일의 MAX_SIDE·QUALITY만.
   ─────────────────────────────────────── */

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig, FORUM_ID } from "./firebase.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const storage = getStorage(app);

const MAX_SIDE = 1600;   // 긴 변 기준
const QUALITY = 0.82;    // JPEG 화질 — 대략 200~400KB로 나온다

/** 원본 파일을 캔버스로 리사이즈해 JPEG Blob으로 반환. 모바일 데이터 사용량을 줄이기 위함. */
export function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > MAX_SIDE || h > MAX_SIDE) {
        const scale = MAX_SIDE / Math.max(w, h);
        w = Math.round(w * scale); h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        blob ? resolve(blob) : reject(new Error('이미지 변환 실패'));
      }, 'image/jpeg', QUALITY);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/** 리사이즈 후 업로드. path 예: board/photos/team3-<timestamp>.jpg */
export async function uploadPhoto(file, teamNo) {
  const blob = await resizeImage(file);
  const path = `forums/${FORUM_ID}/board/${teamNo}/${Date.now()}.jpg`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(r);
  return { url, path };
}

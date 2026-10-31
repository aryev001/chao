# Chào — offline Vietnamese ⇄ English voice translator

An installable web app (PWA) for travelling in Vietnam. It listens to the shopkeeper, speaks the English translation into your earphones, and answers in polite, friendly Vietnamese when you speak or type. After a one-time download, everything runs **on the phone** — no signal, no servers, no API keys.

## What it does

- **Listen** — continuous, hands-free. Detects when someone starts and stops talking, transcribes the Vietnamese, translates it and plays the English in your earphones. Live captions appear while they talk.
- **Speak / type** — English in, Vietnamese out loud. Typing Vietnamese (e.g. copied from a sign) translates it to English instead.
- **Shop-polite tone** — pick who you're talking to (Chị, Anh, Cô, Chú, Bà, Ông, Em, Bạn). The app swaps the stiff machine "bạn/tôi" for the right pronouns and adds "ạ/dạ". "Vui lòng…" becomes a natural spoken request. For example, *"Bạn có thể giảm giá cho tôi không?"* becomes *"Chị có thể giảm giá cho em không ạ?"*
- **Phrasebook first** — ~70 hand-checked phrases (bargaining, sizes, paying by QR, food, taxis, emergencies). If what you say matches one, the app uses the checked version instead of machine translation. These show the tag **Phrasebook**.
- **Prices** — "hai trăm rưỡi nghìn", "50k" and "150.000đ" become exact numbers with a conversion to your currency. When a vendor says a bare "năm mươi", the app flags that it probably means 50,000₫. Say "Can you do 150k?" and it replies *"150.000đ được không chị?"*.
- **Show** — a full-screen card for the shopkeeper, with a **Flip** button for across the counter.
- **North/South** — nghìn/ngàn, đắt/mắc, cốc/ly and similar.
- **Optional Chinese (Mandarin) pack** for Chinese-speaking traders, e.g. Chợ Lớn.

## Put it online (from a phone, ~5 minutes)

All files sit in one folder, so they can be uploaded in one go from a phone.

1. In the Files app, tap `chao-flat.zip` to unzip it.
2. In Safari, open your repo on github.com and tap **Add file › Upload files**. Select every file in the `chao-flat` folder and tap **Commit changes**.
3. Repo **Settings › General › Danger Zone › Change visibility › Public**. Free accounts can only host Pages from public repos.
4. Repo **Settings › Pages › Deploy from a branch › main / (root) › Save**. After a minute or two the app is at `https://<you>.github.io/<repo>/`.

Any static host works too (Netlify, Cloudflare Pages). There's no build step.

## Set up on your phone (on Wi-Fi, before you fly)

1. Open the link in **Chrome (Android)** or **Safari (iPhone)**.
2. The setup screen appears. Choose how you refer to yourself and your first region. Then tap **Download and continue**. The download is about 365 MB.
3. **Install it:** Android shows **Install app** in the ⋮ menu; on iPhone tap **Share › Add to Home Screen**. Open it from the home screen from then on. This keeps the downloads safe from automatic clean-up.
4. **Install an offline Vietnamese voice** (much more natural than the built-in backup):
   - iPhone: Settings › Accessibility › Spoken Content › Voices › Vietnamese › download a voice.
   - Android: Settings › search "Text-to-speech" › Google › Install voice data › Vietnamese.
5. **Test in airplane mode.** The status pill should say *Offline · ready*.

## At the stall

1. Pick who you're talking to (e.g. **Chị** for a woman about your age or older).
2. Optional: on the Phrases tab, play *"Please speak into the phone"* and *"Please speak in short sentences"*.
3. Tap **Listen** and hold the phone towards them. The English plays in your ears.
4. Tap **Speak**, say your reply in English, and pause. The app says it in Vietnamese, and listening resumes on its own.

Tips:
- With Bluetooth earbuds, pick the phone's own microphone in Settings › Microphone, so it hears the shopkeeper rather than just you.
- Phones send *all* sound to connected earbuds. When your reply needs to be heard out loud, take one bud out, or tap **Show**.
- In very noisy markets, turn off *Keep listening after each sentence* and tap Listen once per sentence.

## How it works

| Job | On-device model |
| --- | --- |
| Vietnamese speech → text | [PhoWhisper-base](https://huggingface.co/huuquyet/PhoWhisper-base) (VinAI's Vietnamese-tuned Whisper, ONNX). Fast option: PhoWhisper-tiny |
| English speech → text | [Whisper base.en](https://huggingface.co/Xenova/whisper-base.en) |
| Vietnamese → English | [opus-mt-vi-en](https://huggingface.co/Xenova/opus-mt-vi-en) |
| English → Vietnamese | [opus-mt-en-vi](https://huggingface.co/Xenova/opus-mt-en-vi) |
| Backup Vietnamese voice | [MMS-TTS Vietnamese](https://huggingface.co/Xenova/mms-tts-vie) |
| Chinese pack | Whisper base + opus-mt zh⇄en |
| Normal voices | Your phone's built-in text-to-speech |

- Models run with [Transformers.js](https://github.com/huggingface/transformers.js) v4.3.2 on ONNX Runtime WebAssembly, in a Web Worker. The library and runtime are bundled with the app, so nothing loads from a CDN.
- `sw.js` precaches the app and adds cross-origin isolation headers. That turns on multi-threaded inference even on GitHub Pages. Downloaded models live in Cache Storage.
- **Speed boosts:** if the browser has on-device speech recognition (Chrome's `SpeechRecognition` with `processLocally`) or the built-in `Translator` API, Settings offers to use them. They give instant live captions and often more fluent translation. They are only used when they run locally.

## Honest limits

- **Languages.** Vietnamese is fully supported, plus optional Mandarin. Minority languages (Khmer, Tày, Thái, Mường, Hmong, Cham) have no usable offline models yet. Nearly every shopkeeper you meet will speak Vietnamese.
- **"Real-time"** here means sentence by sentence. Translation starts about 0.7 s after the speaker pauses (adjustable) and usually arrives in 1–3 s on a recent phone.
- **Accuracy.** Recognition copes with northern and southern accents but struggles with heavy noise or several people talking at once. Machine translation is good for short, everyday sentences. The *Phrasebook* and *Price* tags mark hand-checked output.
- **Memory.** All core models together use roughly 700 MB of RAM. On older phones, choose *Fast* recognition in Settings.
- **Browsers:** Chrome on Android, or Safari on iOS 16.4+. Install it to the home screen for reliable offline storage on iPhone.

## Files

`index.html` (UI), `app.js` (mic, voice detection, pipeline, voices, screens), `lang.js` (tone layer, Vietnamese numbers/prices, phrase matching), `phrases.js` (phrasebook), `worker.js` (on-device models), `audio-worklet.js` (16 kHz mic capture), `sw.js` (offline cache + cross-origin isolation), `transformers.min.js` + `ort-wasm-*` (ML runtime), fonts, icons and `manifest.webmanifest`.

Fonts: Be Vietnam Pro (SIL OFL, `OFL.txt`). Transformers.js (Apache-2.0) and ONNX Runtime (MIT) are bundled. To change phrases, edit `phrases.js`; `{A}` is them, `{S}` is you, `{north|south}` picks by region.

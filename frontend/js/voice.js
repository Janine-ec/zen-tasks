// =============================================================
// Voice input - Web Speech API wrapper
// =============================================================

const Voice = (() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return {
      supported: false,
      start() {},
      stop() {},
    };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;
  let onResultCallback = null;
  let onStateCallback = null;

  recognition.addEventListener('result', (e) => {
    const transcript = e.results[0][0].transcript;
    if (onResultCallback) onResultCallback(transcript);
  });

  recognition.addEventListener('end', () => {
    listening = false;
    if (onStateCallback) onStateCallback(false);
  });

  recognition.addEventListener('error', (e) => {
    listening = false;
    if (onStateCallback) onStateCallback(false);
    if (e.error !== 'aborted' && e.error !== 'no-speech') {
      console.error('Speech recognition error:', e.error);
    }
  });

  return {
    supported: true,

    /**
     * Toggle listening on/off.
     */
    toggle() {
      if (listening) {
        recognition.abort();
        listening = false;
        if (onStateCallback) onStateCallback(false);
      } else {
        recognition.start();
        listening = true;
        if (onStateCallback) onStateCallback(true);
      }
    },

    /**
     * Register callback for when speech is recognized.
     * @param {function(string)} cb
     */
    onResult(cb) {
      onResultCallback = cb;
    },

    /**
     * Register callback for listening state changes.
     * @param {function(boolean)} cb
     */
    onStateChange(cb) {
      onStateCallback = cb;
    },
  };
})();

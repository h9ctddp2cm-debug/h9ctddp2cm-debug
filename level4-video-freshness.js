/* Decoded-frame freshness monitor shared by the Level 3/4 live-camera path.
 *
 * `readyState`, `playing`, and non-zero dimensions only say that a video
 * element is usable. They do not prove that Safari is still presenting new
 * camera frames. This monitor records actual decoded-frame advances and gives
 * callers a bounded age, so clinical controllers can fail closed instead of
 * reusing a pose from an indefinitely frozen element.
 */
(function (global) {
  'use strict';

  const EPSILON = 0.0001;

  function createFrameMonitor(options) {
    const opts = options || {};
    const maxAgeMs = Number.isFinite(opts.maxAgeMs) ? opts.maxAgeMs : 750;
    const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
    let video = null;
    let active = false;
    let callbackId = null;
    let generation = 0;
    let lastAdvanceAt = 0;
    let lastMediaTime = null;
    let lastCurrentTime = null;
    let lastPlaybackFrames = null;
    let lastSource = 'none';
    let callbackSeen = false;

    function finite(value) {
      return Number.isFinite(Number(value));
    }

    function baseReady(el) {
      return !!(el
        && el.readyState >= 2
        && !el.paused
        && !el.ended
        && Number(el.videoWidth) > 0
        && Number(el.videoHeight) > 0);
    }

    function recordAdvance(at, source, values) {
      generation += 1;
      lastAdvanceAt = Number.isFinite(at) ? at : now();
      lastSource = source;
      if (values && finite(values.mediaTime)) lastMediaTime = Number(values.mediaTime);
      if (values && finite(values.currentTime)) lastCurrentTime = Number(values.currentTime);
      if (values && finite(values.playbackFrames)) lastPlaybackFrames = Number(values.playbackFrames);
    }

    function observeFrame(metadata, at) {
      const meta = metadata || {};
      const mediaTime = finite(meta.mediaTime) ? Number(meta.mediaTime) : null;
      const presentedFrames = finite(meta.presentedFrames) ? Number(meta.presentedFrames) : null;
      const currentTime = finite(meta.currentTime) ? Number(meta.currentTime) : null;
      const firstFrame = generation === 0;
      const advanced = firstFrame
        || (mediaTime !== null && (lastMediaTime === null || mediaTime > lastMediaTime + EPSILON))
        || (presentedFrames !== null
          && (lastPlaybackFrames === null || presentedFrames > lastPlaybackFrames));
      callbackSeen = true;
      if (advanced) {
        recordAdvance(at, 'requestVideoFrameCallback', {
          mediaTime,
          currentTime,
          playbackFrames: presentedFrames,
        });
      } else {
        if (mediaTime !== null) lastMediaTime = mediaTime;
        if (currentTime !== null) lastCurrentTime = currentTime;
        if (presentedFrames !== null) lastPlaybackFrames = presentedFrames;
      }
      return status(video, at);
    }

    function playbackFrames(el) {
      if (!el || typeof el.getVideoPlaybackQuality !== 'function') return null;
      try {
        const quality = el.getVideoPlaybackQuality();
        return finite(quality && quality.totalVideoFrames) ? Number(quality.totalVideoFrames) : null;
      } catch (_error) {
        return null;
      }
    }

    function poll(el, at) {
      const target = el || video;
      if (!target) return status(target, at);
      const currentTime = finite(target.currentTime) ? Number(target.currentTime) : null;
      const totalFrames = playbackFrames(target);
      const timeAdvanced = currentTime !== null
        && lastCurrentTime !== null
        && currentTime > lastCurrentTime + EPSILON;
      const qualityAdvanced = totalFrames !== null
        && lastPlaybackFrames !== null
        && totalFrames > lastPlaybackFrames;
      if (timeAdvanced || qualityAdvanced) {
        recordAdvance(at, qualityAdvanced ? 'playback-quality' : 'currentTime', {
          currentTime,
          playbackFrames: totalFrames,
        });
      } else {
        if (currentTime !== null) lastCurrentTime = currentTime;
        if (totalFrames !== null) lastPlaybackFrames = totalFrames;
      }
      return status(target, at);
    }

    function scheduleVideoFrameCallback() {
      if (!active || !video || typeof video.requestVideoFrameCallback !== 'function') return;
      try {
        callbackId = video.requestVideoFrameCallback((timestamp, metadata) => {
          callbackId = null;
          if (!active) return;
          observeFrame(metadata, Number.isFinite(timestamp) ? timestamp : now());
          scheduleVideoFrameCallback();
        });
      } catch (_error) {
        callbackId = null;
      }
    }

    function reset() {
      generation = 0;
      lastAdvanceAt = 0;
      lastMediaTime = null;
      lastCurrentTime = null;
      lastPlaybackFrames = null;
      lastSource = 'none';
      callbackSeen = false;
    }

    function start(el) {
      stop();
      video = el || null;
      active = !!video;
      reset();
      // The first poll seeds `currentTime` / playback quality for browsers
      // without requestVideoFrameCallback; later advances are what count.
      poll(video, now());
      scheduleVideoFrameCallback();
      return status(video, now());
    }

    function stop() {
      if (video && callbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
        try { video.cancelVideoFrameCallback(callbackId); } catch (_error) {}
      }
      callbackId = null;
      active = false;
      video = null;
    }

    function status(el, at) {
      const target = el || video;
      const timestamp = Number.isFinite(at) ? at : now();
      const ready = baseReady(target);
      const ageMs = generation > 0 ? Math.max(0, timestamp - lastAdvanceAt) : null;
      const fresh = ready && generation > 0 && ageMs !== null && ageMs <= maxAgeMs;
      let reason = 'awaiting-decoded-frame';
      if (!target) reason = 'no-video';
      else if (target.readyState < 2) reason = 'not-ready';
      else if (target.paused) reason = 'paused';
      else if (target.ended) reason = 'ended';
      else if (!(Number(target.videoWidth) > 0 && Number(target.videoHeight) > 0)) reason = 'no-dimensions';
      else if (generation > 0 && !fresh) reason = 'stale-decoded-frame';
      else if (fresh) reason = 'fresh-decoded-frame';
      return {
        fresh,
        generation,
        ageMs,
        maxAgeMs,
        reason,
        source: lastSource,
        callbackSeen,
        usingVideoFrameCallback: !!(target && typeof target.requestVideoFrameCallback === 'function'),
        currentTime: lastCurrentTime,
        mediaTime: lastMediaTime,
        playbackFrames: lastPlaybackFrames,
        videoWidth: target ? Number(target.videoWidth) || 0 : 0,
        videoHeight: target ? Number(target.videoHeight) || 0 : 0,
      };
    }

    return { start, stop, poll, observeFrame, status };
  }

  const api = { createFrameMonitor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Level4VideoFreshness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

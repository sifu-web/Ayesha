import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const SongsPlayerContext = createContext(null);

/**
 * A single <audio> element lives here, at the top of the app (mounted in
 * App.jsx), so playback survives navigating between pages — the element
 * itself never unmounts, only which page is rendered around it changes.
 *
 * Behavior:
 *  - While the app is open and in the foreground, a playing track keeps
 *    playing no matter which page you're on.
 *  - If "background play" is OFF (the default) for the current track,
 *    switching away from the tab/app (document goes hidden) pauses it, and
 *    coming back to the tab resumes it automatically.
 *  - If "background play" is ON, the track keeps playing even while the
 *    tab/app is hidden.
 *  - Either way, closing the tab/app stops playback — that happens
 *    naturally since the page (and this component) stops running.
 */
export function SongsPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [current, setCurrent] = useState(null); // { id, kind, display_name, url }
  const [isPlaying, setIsPlaying] = useState(false);
  const [backgroundPlay, setBackgroundPlay] = useState(false);
  const wasPlayingBeforeHideRef = useRef(false);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
    }
    const audio = audioRef.current;

    function onEnded() {
      setIsPlaying(false);
    }
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  const play = useCallback((track) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (current?.id === track.id) {
      audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    audio.src = track.url;
    audio.currentTime = 0;
    audio.play();
    setCurrent(track);
    setIsPlaying(true);
    setBackgroundPlay(false); // each newly played track starts with background play off
  }, [current]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !current) return;
    if (isPlaying) {
      pause();
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [current, isPlaying, pause]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }
    setCurrent(null);
    setIsPlaying(false);
    setBackgroundPlay(false);
  }, []);

  // Pause on backgrounding unless this track has background play enabled;
  // resume automatically when the person comes back to the app, as long as
  // it was them switching away (not an explicit pause) that stopped it.
  useEffect(() => {
    function onVisibilityChange() {
      if (!audioRef.current || !current) return;

      if (document.hidden) {
        if (!backgroundPlay) {
          wasPlayingBeforeHideRef.current = isPlaying;
          if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        }
      } else if (wasPlayingBeforeHideRef.current && !backgroundPlay) {
        wasPlayingBeforeHideRef.current = false;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [current, isPlaying, backgroundPlay]);

  const value = {
    current,
    isPlaying,
    backgroundPlay,
    setBackgroundPlay,
    play,
    pause,
    togglePlay,
    stop,
  };

  return <SongsPlayerContext.Provider value={value}>{children}</SongsPlayerContext.Provider>;
}

export function useSongsPlayer() {
  const ctx = useContext(SongsPlayerContext);
  if (!ctx) throw new Error('useSongsPlayer must be used within a SongsPlayerProvider');
  return ctx;
}

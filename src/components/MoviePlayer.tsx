import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipBack, 
  SkipForward,
  Upload,
  Settings,
  Subtitles,
  X,
  Minimize
} from 'lucide-react';

interface AudioTrack {
  id: string;
  label: string;
  language: string;
}

interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  src: string;
}

const MoviePlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  
  const [videoFile, setVideoFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileFormat, setFileFormat] = useState<string>('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<string>('off');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Format time to mm:ss or h:mm:ss
  const formatTime = (time: number): string => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Reset states
      setVideoError(null);
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      
      const url = URL.createObjectURL(file);
      setVideoFile(url);
      setFileName(file.name);
      setFileFormat(file.type || 'Unknown');
      // Reset subtitle tracks when new video is loaded
      setSubtitleTracks([]);
      setSelectedSubtitleTrack('off');
    }
  };

  // Handle subtitle file selection
  const handleSubtitleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newTrack: SubtitleTrack = {
        id: `subtitle-${Date.now()}`,
        label: file.name.replace(/\.[^/.]+$/, ""),
        language: 'Unknown',
        src: url
      };
      
      setSubtitleTracks(prev => [...prev, newTrack]);
      setSelectedSubtitleTrack(newTrack.id);
    }
  };

  // Handle drag and drop
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    
    const videoFile = files.find(file => file.type.startsWith('video/'));
    const subtitleFile = files.find(file => 
      file.name.endsWith('.srt') || 
      file.name.endsWith('.vtt') || 
      file.name.endsWith('.ass') ||
      file.name.endsWith('.ssa')
    );

    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoFile(url);
      setFileName(videoFile.name);
      setFileFormat(videoFile.type || 'Unknown');
      setVideoError(null);
      setIsVideoLoaded(false);
    }

    if (subtitleFile) {
      const url = URL.createObjectURL(subtitleFile);
      const newTrack: SubtitleTrack = {
        id: `subtitle-${Date.now()}`,
        label: subtitleFile.name.replace(/\.[^/.]+$/, ""),
        language: 'Unknown',
        src: url
      };
      
      setSubtitleTracks(prev => [...prev, newTrack]);
      setSelectedSubtitleTrack(newTrack.id);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  // Play/Pause functionality
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying]);

  // Skip functions (10 seconds)
  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
  }, []);

  const skipForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
    }
  }, [duration]);

  // Volume controls
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      setIsMuted(!isMuted);
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  };

  // Playback speed control
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettingsMenu(false);
  };

  // Fullscreen functionality
  const toggleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  }, []);

  // Progress bar handling
  const handleProgressClick = (event: React.MouseEvent) => {
    if (progressRef.current && videoRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const width = rect.width;
      const percentage = clickX / width;
      const newTime = percentage * duration;
      videoRef.current.currentTime = newTime;
    }
  };

  // Show controls with auto-hide
  const showControlsWithTimeout = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Keyboard shortcuts
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        togglePlayPause();
        showControlsWithTimeout();
        break;
      case 'KeyM':
        event.preventDefault();
        toggleMute();
        showControlsWithTimeout();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        skipBackward();
        showControlsWithTimeout();
        break;
      case 'ArrowRight':
        event.preventDefault();
        skipForward();
        showControlsWithTimeout();
        break;
      case 'KeyF':
        event.preventDefault();
        toggleFullscreen();
        break;
      case 'KeyK':
        event.preventDefault();
        togglePlayPause();
        showControlsWithTimeout();
        break;
      case 'KeyJ':
        event.preventDefault();
        skipBackward();
        showControlsWithTimeout();
        break;
      case 'KeyL':
        event.preventDefault();
        skipForward();
        showControlsWithTimeout();
        break;
    }
  }, [togglePlayPause, toggleMute, skipBackward, skipForward, toggleFullscreen, showControlsWithTimeout]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsVideoLoaded(true);
      setVideoError(null);
      
      // Get audio tracks
      const tracks: AudioTrack[] = [];
      const audioTracks = videoRef.current.audioTracks;
      
      if (audioTracks) {
        for (let i = 0; i < audioTracks.length; i++) {
          const track = audioTracks[i];
          tracks.push({
            id: i.toString(),
            label: track.label || `Track ${i + 1}`,
            language: track.language || 'Unknown'
          });
        }
      }
      
      setAudioTracks(tracks);
      if (tracks.length > 0) {
        setSelectedAudioTrack('0');
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setIsBuffering(false);
    setVideoError(null);
  };
  
  const handlePause = () => setIsPlaying(false);
  const handleWaiting = () => setIsBuffering(true);
  const handleCanPlay = () => setIsBuffering(false);
  
  const handleError = () => {
    setIsBuffering(false);
    setIsPlaying(false);
    const video = videoRef.current;
    if (video && video.error) {
      let errorMessage = 'Video playback error';
      switch (video.error.code) {
        case 1:
          errorMessage = 'Video loading was aborted';
          break;
        case 2:
          errorMessage = 'Network error occurred while loading video';
          break;
        case 3:
          errorMessage = 'Video format not supported or corrupted';
          break;
        case 4:
          errorMessage = 'Video format not supported by your browser';
          break;
        default:
          errorMessage = 'Unknown video error occurred';
      }
      setVideoError(errorMessage);
    }
  };

  const handleLoadStart = () => {
    setIsBuffering(true);
    setVideoError(null);
  };

  // Mouse movement for controls visibility
  const handleMouseMove = useCallback(() => {
    showControlsWithTimeout();
  }, [showControlsWithTimeout]);

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
    }
  };

  // Event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const progress = duration ? (currentTime / duration) * 100 : 0;

  if (!videoFile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div 
          className="bg-gray-900 border-2 border-dashed border-gray-600 rounded-xl p-12 text-center max-w-lg w-full hover:border-red-600 transition-all duration-300 hover:bg-gray-800"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Upload className="w-20 h-20 text-gray-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Upload Your Video</h2>
          <p className="text-gray-400 mb-8 text-lg">Drag and drop your video file here, or click to browse</p>
          
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mkv,.avi,.mov,.wmv,.flv,.webm,.m4v"
              onChange={handleFileSelect}
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-8 rounded-lg cursor-pointer transition-all duration-200 inline-block transform hover:scale-105"
            >
              Choose Video File
            </label>
            
            <div className="text-gray-500">
              <p className="text-sm mb-2">You can also add subtitle files (.srt, .vtt, .ass)</p>
              <input
                ref={subtitleInputRef}
                type="file"
                accept=".srt,.vtt,.ass,.ssa"
                onChange={handleSubtitleSelect}
                className="hidden"
                id="subtitle-upload"
              />
              <label
                htmlFor="subtitle-upload"
                className="text-blue-400 hover:text-blue-300 cursor-pointer text-sm underline"
              >
                Add Subtitle File
              </label>
            </div>
          </div>
          
          <div className="text-sm text-gray-500 mt-6 space-y-2">
            <p><strong>Best Support:</strong> MP4, WebM, OGG</p>
            <p><strong>Limited Support:</strong> MKV, AVI, MOV (depends on codecs)</p>
            <p className="text-xs text-gray-600">For MKV files, ensure they use H.264/H.265 video and AAC/MP3 audio codecs</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative bg-black min-h-screen flex items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoFile}
        className="w-full h-full object-contain"
        onLoadStart={handleLoadStart}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onError={handleError}
        onClick={togglePlayPause}
        crossOrigin="anonymous"
        preload="metadata"
      >
        {/* Subtitle tracks */}
        {subtitleTracks.map((track) => (
          <track
            key={track.id}
            kind="subtitles"
            src={track.src}
            srcLang={track.language}
            label={track.label}
            default={selectedSubtitleTrack === track.id}
          />
        ))}
      </video>

      {/* Error Message */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-gray-900 border border-red-600 rounded-xl p-8 text-center max-w-md mx-4">
            <div className="text-red-500 mb-4">
              <X className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Playback Error</h3>
            <p className="text-gray-300 mb-4">{videoError}</p>
            <div className="text-sm text-gray-400 mb-6">
              <p><strong>File:</strong> {fileName}</p>
              <p><strong>Format:</strong> {fileFormat}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setVideoError(null);
                  if (videoRef.current) {
                    videoRef.current.load();
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  setVideoFile(null);
                  setVideoError(null);
                  setFileName('');
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors ml-3"
              >
                Choose Different File
              </button>
            </div>
            <div className="mt-6 text-xs text-gray-500 border-t border-gray-700 pt-4">
              <p className="mb-2"><strong>Tips for MKV files:</strong></p>
              <ul className="text-left space-y-1">
                <li>• Ensure video codec is H.264 or H.265</li>
                <li>• Ensure audio codec is AAC or MP3</li>
                <li>• Consider converting to MP4 for better compatibility</li>
                <li>• Try using a different browser (Chrome/Edge work best)</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      {/* Buffering Indicator */}
      {isBuffering && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading video...</p>
            <p className="text-gray-400 text-sm mt-2">{fileName}</p>
          </div>
        </div>
      )}

      {/* Central Play Button Overlay */}
      {!isPlaying && !isBuffering && !videoError && isVideoLoaded && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black bg-opacity-20 transition-all duration-300"
          onClick={togglePlayPause}
        >
          <div className="bg-black bg-opacity-70 rounded-full p-8 hover:bg-opacity-90 transition-all duration-200 transform hover:scale-110">
            <Play className="w-20 h-20 text-white ml-2" />
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent transition-all duration-300 ${
          showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Progress Bar */}
        <div className="px-6 pb-2">
          <div 
            ref={progressRef}
            className="w-full h-1 bg-gray-600 rounded-full cursor-pointer hover:h-2 transition-all duration-200 group"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-red-600 rounded-full transition-all duration-200 relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between px-6 pb-6">
          <div className="flex items-center space-x-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="text-white hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-10"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
            </button>

            {/* Skip Backward */}
            <button
              onClick={skipBackward}
              className="text-white hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-10"
              title="Back 10 seconds"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            {/* Skip Forward */}
            <button
              onClick={skipForward}
              className="text-white hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-10"
              title="Forward 10 seconds"
            >
              <SkipForward className="w-6 h-6" />
            </button>

            {/* Volume Controls */}
            <div className="flex items-center space-x-3 group">
              <button
                onClick={toggleMute}
                className="text-white hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-10"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
              <div className="w-0 group-hover:w-24 overflow-hidden transition-all duration-300">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-24 accent-red-600 bg-gray-600 rounded-full"
                />
              </div>
            </div>

            {/* Time Display */}
            <div className="text-white text-sm font-mono bg-black bg-opacity-50 px-3 py-1 rounded">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Subtitle Button */}
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="text-white hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-10"
              title="Subtitles & Settings"
            >
              <Subtitles className="w-6 h-6" />
            </button>

            {/* Settings Menu */}
            {showSettingsMenu && (
              <div className="absolute bottom-full right-0 mb-4 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg shadow-2xl p-4 min-w-64 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Settings</h3>
                  <button
                    onClick={() => setShowSettingsMenu(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Playback Speed */}
                <div className="mb-4">
                  <div className="text-white text-sm font-medium mb-2">Playback Speed</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        className={`px-3 py-2 rounded text-sm transition-colors ${
                          playbackRate === rate 
                            ? 'bg-red-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtitles */}
                <div className="mb-4">
                  <div className="text-white text-sm font-medium mb-2">Subtitles</div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedSubtitleTrack('off')}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedSubtitleTrack === 'off' 
                          ? 'bg-red-600 text-white' 
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      Off
                    </button>
                    {subtitleTracks.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => setSelectedSubtitleTrack(track.id)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          selectedSubtitleTrack === track.id 
                            ? 'bg-red-600 text-white' 
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {track.label}
                      </button>
                    ))}
                    <label
                      htmlFor="subtitle-upload-player"
                      className="w-full text-left px-3 py-2 rounded text-sm text-blue-400 hover:bg-gray-700 cursor-pointer block"
                    >
                      + Add Subtitle File
                    </label>
                    <input
                      type="file"
                      accept=".srt,.vtt,.ass,.ssa"
                      onChange={handleSubtitleSelect}
                      className="hidden"
                      id="subtitle-upload-player"
                    />
                  </div>
                </div>

                {/* Audio Tracks */}
                {audioTracks.length > 1 && (
                  <div>
                    <div className="text-white text-sm font-medium mb-2">Audio Track</div>
                    <div className="space-y-1">
                      {audioTracks.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => setSelectedAudioTrack(track.id)}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                            selectedAudioTrack === track.id 
                              ? 'bg-red-600 text-white' 
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {track.label} ({track.language})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* File Name */}
            <div className="text-white text-sm max-w-48 truncate bg-black bg-opacity-50 px-3 py-1 rounded">
              {fileName} {fileFormat && `(${fileFormat.split('/')[1]?.toUpperCase() || 'Unknown'})`}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-10"
            >
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Info - Only on Hover */}
      <div 
        className="absolute top-4 right-4 transition-all duration-300"
        onMouseEnter={() => setShowShortcuts(true)}
        onMouseLeave={() => setShowShortcuts(false)}
      >
        <div className="text-white bg-black bg-opacity-60 p-2 rounded-full cursor-help">
          <Settings className="w-5 h-5" />
        </div>
        
        {showShortcuts && (
          <div className="absolute top-full right-0 mt-2 text-xs text-gray-300 bg-black bg-opacity-90 backdrop-blur-sm p-4 rounded-lg shadow-2xl border border-gray-700 min-w-48">
            <div className="font-semibold text-white mb-2">Keyboard Shortcuts</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-gray-400">Space/K:</span><span>Play/Pause</span>
              <span className="text-gray-400">M:</span><span>Mute</span>
              <span className="text-gray-400">←/J:</span><span>Back 10s</span>
              <span className="text-gray-400">→/L:</span><span>Forward 10s</span>
              <span className="text-gray-400">F:</span><span>Fullscreen</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoviePlayer;
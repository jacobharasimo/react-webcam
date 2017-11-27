import React, { Component } from 'react';
import PropTypes from 'prop-types';

function hasGetUserMedia() {
  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

export default class Webcam extends Component {
  static defaultProps = {
    fullResolutionScreenshot: false,
    audio: true,
    className: '',
    height: 480,
    muted: false,
    onUserMedia: () => {
    },
    screenshotFormat: 'image/webp',
    width: 640,
    cameraSelector: 'front'
  };

  static propTypes = {
    fullResolutionScreenshot: PropTypes.bool,
    audio: PropTypes.bool,
    muted: PropTypes.bool,
    onUserMedia: PropTypes.func,
    height: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]),
    width: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]),
    cameraSelector: PropTypes.oneOf([
      'front',
      'back'
    ]),
    screenshotFormat: PropTypes.oneOf([
      'image/webp',
      'image/png',
      'image/jpeg'
    ]),
    style: PropTypes.object,
    className: PropTypes.string,
    videoSource: PropTypes.string
  };

  static mountedInstances = [];

  static userMediaRequested = false;

  constructor() {
    super();
    this.state = {
      hasUserMedia: false
    };
  }

  componentDidMount() {
    if (!hasGetUserMedia()) {
      return;
    }

    Webcam.mountedInstances.push(this);

    if (!this.state.hasUserMedia && !Webcam.userMediaRequested) {
      this.requestUserMedia();
    }
  }

  componentWillUnmount() {
    const index = Webcam.mountedInstances.indexOf(this);
    Webcam.mountedInstances.splice(index, 1);

    if (Webcam.mountedInstances.length === 0 && this.state.hasUserMedia) {
      if (this.stream.stop) {
        this.stream.stop();
      } else {
        if (this.stream.getVideoTracks) {
          this.stream.getVideoTracks().map(track => track.stop());
        }
        if (this.stream.getAudioTracks) {
          this.stream.getAudioTracks().map(track => track.stop());
        }
      }
      Webcam.userMediaRequested = false;
      window.URL.revokeObjectURL(this.state.src);
    }
  }

  getScreenshot() {
    if (!this.state.hasUserMedia) {
      return null;
    }

    const canvas = this.getCanvas();
    return canvas && canvas.toDataURL(this.props.screenshotFormat);
  }

  getCanvas() {
    const video = this.video;

    if (!this.state.hasUserMedia || !video.videoHeight) {
      return null;
    }

    if (!this.ctx) {
      const canvas = document.createElement('canvas');
      if (!this.props.fullResolutionScreenshot) {
        const aspectRatio = video.videoWidth / video.videoHeight;
        canvas.width = video.clientWidth;
        canvas.height = video.clientWidth / aspectRatio;
      } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    }

    const { ctx, canvas } = this;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  requestUserMedia() {
    navigator.getUserMedia = navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    const sourceSelected = (videoConstraints) => {
      const cameraSelector = this.props.cameraSelector === 'back'
        ?
        'user' : /* front */
        'enviroment'; /* back */

      const constraints = {
        video: {
          facingMode: cameraSelector,
          width: {
            min: 1024,
            ideal: 1280,
            max: 1920
          },
          height: {
            ideal: 720,
            max: 1080
          }
        }
      };
      if (videoConstraints) {
        Object.merge(constraints.video, videoConstraints);
      }

      if (!this.props.audio) {
        constraints.audio = false;
      }

      navigator.getUserMedia(constraints, (stream) => {
        Webcam.mountedInstances.forEach(instance => instance.handleUserMedia(null, stream));
      }, (e) => {
        Webcam.mountedInstances.forEach(instance => instance.handleUserMedia(e));
      });
    };

    sourceSelected(this.props.videoSource);

    Webcam.userMediaRequested = true;
  }

  handleUserMedia(error, stream) {
    if (error) {
      this.setState({
        hasUserMedia: false
      });

      return;
    }
    try {
      const src = window.URL.createObjectURL(stream);

      this.stream = stream;
      this.setState({
        hasUserMedia: true,
        src
      });

      this.props.onUserMedia();
    } catch (e) {
      this.stream = stream;
      this.video.srcObject = stream;
      this.setState({
        hasUserMedia: true
      });
    }
  }

  render() {
    const { width, height, muted, className, style } = this.props;
    const { src } = this.state;
    return (
      <video
        autoPlay
        width={width}
        height={height}
        src={src}
        muted={muted}
        className={className}
        style={style}
        ref={(ref) => {
          this.video = ref;
        }}
      />
    );
  }
}

import React, { Component } from 'react';
import PropTypes from 'prop-types';

function hasGetUserMedia() {
  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

const defaultConstraints = {
  video: {
    facingMode: 'user',
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
      hasUserMedia: false,
      cameraSelector: 'front',
      deviceCount: 0
    };

    this.devices = navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        const videoDevices = [];
        devices.forEach((device) => {
          if (device.kind === 'videoinput') {
            videoDevices.push(device);
          }
        });
        this.setState({ deviceCount: videoDevices.length });
        const constraints = {
          deviceId: { exact: devices[1] }
        };
        Object.assign(constraints, defaultConstraints);
        return videoDevices;
      });
  }

  componentWillMount() {
    // console.log('initial value ', this.props.cameraSelector);
    this.setCameraEnviroment(this.props.cameraSelector);
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

  componentWillReceiveProps(nextProps) {
    // You don't have to do this check first, but it can help prevent an unneeded render
    if (nextProps.cameraSelector !== this.props.cameraSelector) {
      if (this.canSwitchCamera()) {
        this.setCameraEnviroment(nextProps.cameraSelector);
        setTimeout(() => {
          this.requestUserMedia();
        }, 0);
      }
    }
  }

  componentWillUnmount() {
    this.closeMediaStream();
    const index = Webcam.mountedInstances.indexOf(this);
    Webcam.mountedInstances.splice(index, 1);
    if (Webcam.mountedInstances.length === 0 && this.state.hasUserMedia) {
      Webcam.userMediaRequested = false;
      window.URL.revokeObjectURL(this.state.src);
    }
  }

  setCameraEnviroment(direction) {
    const cameraSelector = direction === 'back' ?
      'environment' :
      'user';
    // console.log('camera selector changed to ', direction, ' setting ', cameraSelector);
    this.setState({ cameraSelector });
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

  canSwitchCamera() {
    return this.state.deviceCount > 1;
  }

  closeMediaStream() {
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
  }

  requestUserMedia() {
    if (this.stream && this.stream.active) {
      // console.log('close stream');
      this.closeMediaStream();
      // this.stream.getVideoTracks().map(track => track.stop());
    }
    // console.log('render user media object');
    navigator.getUserMedia = navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;


    const sourceSelected = (videoConstraints) => {
      console.info(`activate ${this.state.cameraSelector} camera`);

      const constraints = defaultConstraints;
      constraints.video.facingMode = this.state.cameraSelector;

      if (videoConstraints) {
        Object.assign(constraints.video, videoConstraints);
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

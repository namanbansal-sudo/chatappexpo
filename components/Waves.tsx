import React from 'react';
import Svg, { Path } from 'react-native-svg';

const Waves = () => (
  <Svg
    height="100%"
    width="100%"
    viewBox="0 0 1440 320"
    style={{ position: 'absolute', top: 0, left: 0 }}
  >
    {/* Repeat subtle curved paths to create multiple waves */}
    <Path
      fill="none"
      stroke="rgba(255,255,255,0.05)"
      strokeWidth="1"
      d="M0,160 C480,320 960,0 1440,160"
    />
    <Path
      fill="none"
      stroke="rgba(255,255,255,0.04)"
      strokeWidth="1"
      d="M0,200 C480,360 960,40 1440,200"
    />
    <Path
      fill="none"
      stroke="rgba(255,255,255,0.03)"
      strokeWidth="1"
      d="M0,240 C480,400 960,80 1440,240"
    />
  </Svg>
);

export default Waves;

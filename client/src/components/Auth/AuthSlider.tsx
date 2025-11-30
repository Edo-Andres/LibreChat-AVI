import React from 'react';

export default function AuthSlider() {
  return (
    <div className="relative hidden h-full w-5/12 flex-col justify-end overflow-hidden bg-gray-900 lg:flex">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover object-bottom"
      >
        <source src="/assets/img_avi/video_avi_2.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      
    </div>
  );
}

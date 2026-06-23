import React, { useState, useEffect } from 'react';

const slides = [
  {
    title: 'Si estás aquí es porque\nte importa cuidar',
    description: 'Niños, niñas y adolescentes nos necesitan',
    srcDesktop: '/assets/img_avi/slide-1.mp4',
    srcMobile: '/assets/img_avi/slide-1.mp4', // TODO: Cambiar por imagen vertical/mobile
  },
  {
    title: 'Tu dedicación diaria\ntransforma vidas',
    description: 'Te acompañamos en la reflexión con conocimiento basados en evidencia',
    srcDesktop: '/assets/img_avi/slide-2-avi-hand2.mp4',
    srcMobile: '/assets/img_avi/slide-2-avi-hand2.mp4', // TODO: Cambiar por video vertical/mobile
  },
  {
    title: 'AVI te acompaña',
    description: 'Sé parte de una gran comunidad para el cuidado',
    srcDesktop: '/assets/img_avi/slide-3-avi-child-mountain.mp4',
    srcMobile: '/assets/img_avi/slide-3-avi-child-mountain.mp4', // TODO: Cambiar por video vertical/mobile
  },
];

const isVideo = (src: string) => {
  return src.endsWith('.mp4') || src.endsWith('.webm') || src.endsWith('.ogg');
};

export default function AuthSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 7000); // Change slide every 7 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="dynamic-bg"
      className="relative flex h-[35vh] w-full flex-col justify-center overflow-hidden bg-gray-900 lg:h-full lg:w-5/12 lg:justify-between"
    >
      {/* Background Layer */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-0' : 'opacity-0 z-0'
            }`}
        >
          {/* Desktop Media */}
          <div className="hidden h-full w-full lg:block">
            {isVideo(slide.srcDesktop) ? (
              <video
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover object-bottom"
              >
                <source src={slide.srcDesktop} type="video/mp4" />
              </video>
            ) : (
              <div
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url('${slide.srcDesktop}')` }}
              />
            )}
          </div>

          {/* Mobile Media */}
          <div className="block h-full w-full lg:hidden">
            {isVideo(slide.srcMobile) ? (
              <video
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover object-center"
              >
                <source src={slide.srcMobile} type="video/mp4" />
              </video>
            ) : (
              <div
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url('${slide.srcMobile}')` }}
              />
            )}
          </div>
        </div>
      ))}

      {/* Overlay for readability */}
      <div className="absolute inset-0 z-0 bg-black/20 mix-blend-multiply"></div>

      {/* Decorative Gradients */}
      <div
        id="gradient-overlay"
        className="absolute inset-0 z-0 bg-gradient-to-br from-green-900/80 to-black/80"
      ></div>

      <div className="relative z-10 flex h-full w-full flex-col justify-center items-center p-6 text-center text-white lg:items-start lg:justify-between lg:p-16 lg:text-left">
        {/* AVI Logo */}
        <div className="flex w-full justify-center lg:justify-center">
          <img
            src="/assets/img_avi/avi-modern-blue.png"
            alt="AVI Logo"
            style={{ filter: 'hue-rotate(300deg)' }}
            className="w-[60px] lg:w-[80px] h-auto"
          />
        </div>

        {/* Text Slider */}
        <div className="relative w-full max-w-sm lg:max-w-full">
          <div id="slider-container" className="relative h-32 lg:h-96">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 flex flex-col justify-center items-center transition-opacity duration-700 ease-in-out lg:items-start ${index === currentSlide
                  ? 'z-10 opacity-100'
                  : 'pointer-events-none z-0 opacity-0'
                  }`}
              >
                <h2 className="mb-3 whitespace-pre-line text-3xl font-bold leading-tight lg:mb-6 lg:text-5xl">
                  {slide.title}
                </h2>
                <p className="text-sm font-light text-gray-200 lg:text-xl">{slide.description}</p>
              </div>
            ))}
          </div>

          {/* Indicators */}
          <div className="relative z-20 mx-auto mt-4 hidden w-4/5 justify-center space-x-3 lg:flex">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 flex-1 rounded-full bg-white transition-all duration-300 ${index === currentSlide
                  ? 'opacity-100 hover:opacity-100'
                  : 'opacity-40 hover:opacity-70'
                  }`}
              />
            ))}
          </div>
        </div>
        <div className="hidden lg:flex lg:flex-col lg:items-start">
          <img
            src="/assets/img_avi/ccm-logo-black2.png"
            alt="Corporación Crecer Mejor"
            style={{ filter: 'invert(1)' }}
            className="w-[80px] h-auto opacity-80 mb-2"
          />
          <div className="text-xs uppercase tracking-widest text-gray-400">
            © 2025 Corporación Crecer Mejor.
          </div>
        </div>
      </div>
    </div>
  );
}

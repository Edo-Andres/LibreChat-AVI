import React, { useState, useEffect } from 'react';

const slides = [
  {
    title: 'Resguardamos la\ninfancia',
    description: 'Para fomentar entornos más seguros y saludables para los niños, niñas y adolescentes',
    image: '/assets/img_avi/slide-1-inteligencia.jpg',
  },
  {
    title: 'Conocimiento\nque Protege',
    description: 'Respuestas construidas sobre evidencia científica y datos de alta calidad en los que puedes confiar.',
    image: '/assets/img_avi/slide-2-avi-hand2.mp4',
  },
  {
    title: 'Sé parte\ndel Cambio',
    description: 'Tu participación fortalece nuestra comunidad. Juntos construimos un mejor mañana.',
    image: '/assets/img_avi/slide-3-avi-child-mountain.mp4',
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
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === currentSlide ? 'opacity-100 z-0' : 'opacity-0 z-0'
          }`}
        >
          {isVideo(slide.image) ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover object-bottom"
            >
              <source src={slide.image} type="video/mp4" />
            </video>
          ) : (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url('${slide.image}')` }}
            />
          )}
        </div>
      ))}

      {/* Overlay for readability */}
      <div className="absolute inset-0 z-0 bg-black/50 mix-blend-multiply"></div>

      {/* Decorative Gradients */}
      <div
        id="gradient-overlay"
        className="absolute inset-0 z-0 bg-gradient-to-br from-green-900/80 to-black/80"
      ></div>

      <div className="relative z-10 flex h-full w-full flex-col justify-center items-center p-6 text-center text-white lg:items-start lg:justify-between lg:p-16 lg:text-left">
        {/* Spacer */}
        <div className="hidden h-16 w-full lg:block"></div>

        {/* Text Slider */}
        <div className="relative w-full max-w-sm lg:max-w-full">
          <div id="slider-container" className="relative h-32 lg:h-96">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 flex flex-col justify-center items-center transition-opacity duration-700 ease-in-out lg:items-start ${
                  index === currentSlide
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
                className={`h-1.5 flex-1 rounded-full bg-white transition-all duration-300 ${
                  index === currentSlide
                    ? 'opacity-100 hover:opacity-100'
                    : 'opacity-40 hover:opacity-70'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="hidden text-xs uppercase tracking-widest text-gray-400 lg:block">
          © 2025 Corporación Crecer Mejor.
        </div>
      </div>
    </div>
  );
}

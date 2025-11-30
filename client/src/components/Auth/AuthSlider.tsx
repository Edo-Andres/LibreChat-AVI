import React, { useState, useEffect } from 'react';

const slides = [
  {
    title: 'Tu Asistente\nInteligente',
    description: 'Potencia tu aprendizaje con la tecnología más avanzada de CCM.',
    image: '/assets/img_avi/slide-1-inteligencia.jpg',
  },
  {
    title: 'Aprendizaje\nAdaptativo',
    description: 'Contenidos personalizados que evolucionan contigo paso a paso.',
    image: '/assets/img_avi/slide-2-adaptativo.jpg',
  },
  {
    title: 'Comunidad\nGlobal',
    description: 'Conecta con estudiantes y mentores de todo el mundo.',
    image: '/assets/img_avi/slide-3-comunidad.jpg',
  },
];

export default function AuthSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="dynamic-bg"
      className="relative hidden h-full w-5/12 flex-col justify-between overflow-hidden bg-gray-900 bg-cover bg-center p-16 text-white transition-all duration-1000 ease-in-out lg:flex"
      style={{
        backgroundImage: `url('${slides[currentSlide].image}')`,
        transition: 'background-image 1.2s ease-in-out',
      }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 z-0 bg-black/50 mix-blend-multiply"></div>

      {/* Decorative Gradients */}
      <div
        id="gradient-overlay"
        className="absolute inset-0 z-0 bg-gradient-to-br from-green-900/80 to-black/80 transition-all duration-1000"
      ></div>

      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        {/* Spacer */}
        <div className="h-16 w-full"></div>

        {/* Text Slider */}
        <div className="relative w-full">
          <div id="slider-container" className="relative h-96">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 flex flex-col justify-center transition-opacity duration-700 ease-in-out ${
                  index === currentSlide
                    ? 'z-10 opacity-100'
                    : 'pointer-events-none z-0 opacity-0'
                }`}
              >
                <h2 className="mb-6 whitespace-pre-line text-5xl font-bold leading-tight">
                  {slide.title}
                </h2>
                <p className="text-xl font-light text-gray-200">{slide.description}</p>
              </div>
            ))}
          </div>

          {/* Indicators */}
          <div className="relative z-20 mx-auto mt-4 flex w-4/5 justify-center space-x-3">
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
        <div className="text-xs uppercase tracking-widest text-gray-400">
          © 2025 CCM Education
        </div>
      </div>
    </div>
  );
}

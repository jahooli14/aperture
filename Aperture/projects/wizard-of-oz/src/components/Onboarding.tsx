import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Camera, Eye, Shield, X } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const screens = [
  {
    id: 1,
    icon: Camera,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    title: 'Welcome to Wizard of Oz',
    subtitle: 'Watch Your Baby Grow',
    description: 'Capture one photo each day and create a magical timelapse of your baby\'s first year. Our app automatically aligns photos for a smooth, professional result.',
    features: [
      '📸 One photo per day',
      '✨ Automatic face alignment',
      '🎬 Beautiful timelapse videos',
    ],
  },
  {
    id: 2,
    icon: Shield,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    title: 'Your Privacy Matters',
    subtitle: 'Safe & Secure',
    description: 'Your baby\'s photos are precious. We take security seriously with enterprise-grade encryption and privacy controls.',
    features: [
      '🔒 End-to-end encryption',
      '👤 Only you can see your photos',
      '🚫 Never shared or sold',
    ],
  },
  {
    id: 3,
    icon: Eye,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
    title: 'Key Features',
    subtitle: 'Getting Started',
    description: 'Everything you need to create beautiful daily memories of your growing baby.',
    features: [
      '📅 Backdate photos - never miss a day',
      '🔍 Smart eye detection & alignment',
      '📱 Works offline - upload later',
    ],
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [direction, setDirection] = useState(1);

  const handleNext = () => {
    if (currentScreen < screens.length - 1) {
      setDirection(1);
      setCurrentScreen(currentScreen + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleDotClick = (index: number) => {
    setDirection(index > currentScreen ? 1 : -1);
    setCurrentScreen(index);
  };

  const screen = screens[currentScreen];
  const Icon = screen.icon;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {/* Skip Button */}
      <div className="absolute top-4 right-4 z-10">
        <motion.button
          onClick={handleSkip}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100"
          aria-label="Skip onboarding"
        >
          <X className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Content */}
      <div className="h-full flex flex-col items-center justify-center px-6 py-12 max-w-md mx-auto">
        {/* Icon */}
        <motion.div
          key={`icon-${currentScreen}`}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className={`w-24 h-24 ${screen.iconBg} rounded-full flex items-center justify-center mb-8`}
        >
          <Icon className={`w-12 h-12 ${screen.iconColor}`} />
        </motion.div>

        {/* Animated Content */}
        <div className="flex-1 flex items-center justify-center w-full overflow-hidden relative">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentScreen}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute w-full text-center"
            >
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {screen.title}
              </h1>
              <p className="text-lg text-primary-600 font-semibold mb-6">
                {screen.subtitle}
              </p>
              <p className="text-gray-600 mb-8 leading-relaxed">
                {screen.description}
              </p>

              {/* Features */}
              <div className="space-y-4 mb-8">
                {screen.features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                    className="flex items-center justify-center gap-3 text-left"
                  >
                    <div className="flex-1 max-w-xs">
                      <p className="text-base text-gray-700">{feature}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots Indicator */}
        <div className="flex gap-2 mb-8">
          {screens.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className="group p-2"
              aria-label={`Go to screen ${index + 1}`}
            >
              <motion.div
                animate={{
                  width: currentScreen === index ? 32 : 8,
                  backgroundColor:
                    currentScreen === index ? 'rgb(37, 99, 235)' : 'rgb(209, 213, 219)',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="h-2 rounded-full group-hover:bg-blue-400"
              />
            </button>
          ))}
        </div>

        {/* Next/Get Started Button */}
        <motion.button
          onClick={handleNext}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="w-full max-w-xs bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold py-4 px-6 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2 min-h-[56px]"
        >
          <span>
            {currentScreen === screens.length - 1 ? 'Get Started' : 'Next'}
          </span>
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}

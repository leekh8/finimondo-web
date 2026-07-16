import React from 'react';

const TYPE_STYLE = {
  info:  'bg-plasma/90',
  warn:  'bg-sulfur text-black',
  error: 'bg-ember',
};

export default function Notification({ msg, type = 'info' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50
      ${TYPE_STYLE[type]} text-white px-5 py-3 rounded-xl shadow-xl
      text-sm font-semibold max-w-xs text-center
      animate-[fadeInDown_0.2s_ease-out]`}>
      {msg}
    </div>
  );
}

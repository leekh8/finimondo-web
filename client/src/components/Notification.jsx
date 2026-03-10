import React from 'react';

const TYPE_STYLE = {
  info:  'bg-blue-600',
  warn:  'bg-yellow-500 text-black',
  error: 'bg-red-600',
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

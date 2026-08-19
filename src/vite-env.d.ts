/// <reference types="vite/client" />

// Shipped as plain JS with no bundled typings; only ever used as a lazy loader,
// so `any` here is the honest shape rather than a cover-up.
declare module 'intl-tel-input/utils' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utils: any;
  export default utils;
}

declare module 'intl-tel-input/styles';

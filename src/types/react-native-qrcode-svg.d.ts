declare module 'react-native-qrcode-svg' {
  import type { FC } from 'react';

  interface QRCodeProps {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    logo?: any;
    logoSize?: number;
    logoBackgroundColor?: string;
    logoMargin?: number;
    logoBorderRadius?: number;
    quietZone?: number;
    enableLinearGradient?: boolean;
    linearGradient?: [string, string];
    gradientDirection?: [string, string, string, string];
    getRef?: (ref: any) => void;
    ecl?: 'L' | 'M' | 'Q' | 'H';
    onError?: (error: Error) => void;
    testID?: string;
  }

  const QRCode: FC<QRCodeProps>;
  export default QRCode;
}

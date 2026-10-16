import { type I18n } from '@lingui/core';
import { Img } from 'react-email';

import { AIRPAL_LOGO_URL } from 'src/constants/AirPalLogoUrl';

const logoStyle = {
  marginBottom: '40px',
};

type LogoProps = {
  i18n: I18n;
};

export const Logo = ({ i18n }: LogoProps) => {
  return (
    <Img
      src={AIRPAL_LOGO_URL}
      alt={i18n._('AirPal CRM logo')}
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};

import { Container } from 'react-email';
import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';

const footerContainerStyle = {
  marginTop: '12px',
};

export const Footer = () => {
  return (
    <Container style={footerContainerStyle}>
      <ShadowText>
        <Link href="https://crm.airpal.co.uk/" value="AirPal CRM" />
      </ShadowText>
    </Container>
  );
};

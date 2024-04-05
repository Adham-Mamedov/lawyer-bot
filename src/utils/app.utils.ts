import { appConfig } from '@src/config/app.config';
import { AppConfig } from '@src/types/config.types';

export const validateEnv = () => {
  const missingVariables = Object.keys(appConfig).filter(
    (key) => appConfig[key as keyof AppConfig] === '',
  );

  if (missingVariables.length > 0) {
    console.error(
      `Missing environment variables: ${missingVariables.join(', ')}`,
    );
    process.exit(1);
  }
};

import path from 'path';

type TGetDatasetPathOptions = {
  extension: string;
};
export const getDatasetPath = (
  fileName: string,
  options?: TGetDatasetPathOptions,
) => {
  return path.join(
    process.cwd(),
    'src',
    'datasets',
    `${fileName}.${options?.extension || 'json'}`,
  );
};

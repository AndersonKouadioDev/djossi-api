import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route accessible sans access token (le guard JWT global est bypassé). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

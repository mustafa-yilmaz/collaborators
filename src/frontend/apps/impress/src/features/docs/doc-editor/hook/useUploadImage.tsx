import { useCallback } from 'react';

import { useMediaUrl } from '@/core/config/hooks/useMediaUrl';

import { loopCheckDocMediaStatus } from '../api';
import { ANALYZE_URL } from '../conf';

import { useUploadFile } from './useUploadFile';

/**
 * Upload an image attached to a document, and give its final address: files
 * are checked first, and only then served from the media address.
 */
export const useUploadImage = (docId: string) => {
  const { uploadFile } = useUploadFile(docId);
  const mediaUrl = useMediaUrl();

  return useCallback(
    async (file: File) => {
      const url = await uploadFile(file);
      if (!url.includes(ANALYZE_URL)) {
        return url;
      }
      const checked = await loopCheckDocMediaStatus(
        url,
        new AbortController().signal,
      );
      return `${mediaUrl}${checked.file}`;
    },
    [uploadFile, mediaUrl],
  );
};

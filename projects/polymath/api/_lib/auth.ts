/**
 * Authentication Helper
 * Returns user ID for API requests
 */
export function getUserId(req?: any) {
    // Check for user ID in header (passed by frontend store)
    if (req?.headers?.['x-user-id']) {
        return req.headers['x-user-id'] as string;
    }

    // Single user app - hardcoded user ID fallback
    return 'f2404e61-2010-46c8-8edd-b8a3e702f0fb';
}

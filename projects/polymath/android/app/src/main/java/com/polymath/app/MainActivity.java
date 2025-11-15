package com.polymath.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        String action = intent.getAction();
        String type = intent.getType();

        // Handle SEND intent (share from other apps)
        if (Intent.ACTION_SEND.equals(action) && type != null) {
            if ("text/plain".equals(type)) {
                handleSharedText(intent);
            }
        }
    }

    private void handleSharedText(Intent intent) {
        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);

        if (sharedText != null && !sharedText.isEmpty()) {
            // Create a deep link to handle the shared URL in the app
            String deepLink = "polymath://share?url=" + Uri.encode(sharedText);

            // Trigger the app URL open listener
            Intent deepLinkIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink));
            deepLinkIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(deepLinkIntent);
        }
    }
}

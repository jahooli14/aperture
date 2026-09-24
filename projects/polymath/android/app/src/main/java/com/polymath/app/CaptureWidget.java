package com.polymath.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * One-button home-screen widget: tap it and the app opens already
 * recording. It launches polymath://capture, which the web side turns
 * into a running recorder (src/lib/launchCapture.ts).
 */
public class CaptureWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("polymath://capture"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        for (int id : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.capture_widget);
            views.setOnClickPendingIntent(R.id.capture_button, pending);
            manager.updateAppWidget(id, views);
        }
    }
}

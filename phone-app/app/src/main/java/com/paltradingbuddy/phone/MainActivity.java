package com.paltradingbuddy.phone;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String HOME = "https://pal-market-data-api.onrender.com/dashboard?app=1";
    private static final String HOST = "pal-market-data-api.onrender.com";
    private static final int BG = Color.rgb(5, 9, 12);
    private static final int PANEL = Color.rgb(11, 21, 25);
    private static final int TEAL = Color.rgb(124, 233, 202);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private ProgressBar progress;
    private LinearLayout retryPanel;
    private TextView messageTitle;
    private TextView messageBody;
    private Button retryButton;
    private boolean pageLoaded;
    private final Runnable loadingDeadline = () -> {
        if (!pageLoaded) {
            showRetry("PAL server is taking longer than expected",
                    "The app is installed and running. The hosted service may be waking up or your connection is slow. Tap Retry to try again.");
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(BG);
        window.setNavigationBarColor(BG);
        window.getDecorView().setSystemUiVisibility(0);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        webView = new WebView(this);
        webView.setBackgroundColor(BG);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(TEAL));
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        root.addView(progress, progressParams);
        retryPanel = buildRetryPanel();
        retryPanel.setVisibility(View.GONE);
        root.addView(retryPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                pageLoaded = false;
                progress.setVisibility(View.VISIBLE);
                retryPanel.setVisibility(View.GONE);
                handler.removeCallbacks(loadingDeadline);
                handler.postDelayed(loadingDeadline, 12_000);
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                pageLoaded = true;
                handler.removeCallbacks(loadingDeadline);
                progress.setVisibility(View.GONE);
                retryPanel.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageLoaded = true;
                handler.removeCallbacks(loadingDeadline);
                progress.setVisibility(View.GONE);
                retryPanel.setVisibility(View.GONE);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ex) {
                    Toast.makeText(MainActivity.this, "No app found to open this link.", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) {
                    pageLoaded = false;
                    handler.removeCallbacks(loadingDeadline);
                    progress.setVisibility(View.GONE);
                    showRetry("Could not open PAL Trading Buddy",
                            "Check your internet connection, then tap Retry. Market data needs internet access.");
                }
            }
        });
        loadHome();
    }

    private void loadHome() {
        pageLoaded = false;
        retryPanel.setVisibility(View.GONE);
        progress.setVisibility(View.VISIBLE);
        handler.removeCallbacks(loadingDeadline);
        handler.postDelayed(loadingDeadline, 12_000);
        webView.loadUrl(HOME);
    }

    private LinearLayout buildRetryPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(BG);

        TextView brand = new TextView(this);
        brand.setText("PAL  TRADING BUDDY");
        brand.setTextColor(TEAL);
        brand.setTextSize(13);
        brand.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        brand.setLetterSpacing(0.08f);
        brand.setGravity(Gravity.CENTER);
        panel.addView(brand, matchWrap());

        messageTitle = new TextView(this);
        messageTitle.setText("Opening your trading dashboard");
        messageTitle.setTextColor(Color.rgb(231, 239, 241));
        messageTitle.setTextSize(21);
        messageTitle.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        messageTitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = matchWrap();
        titleParams.topMargin = dp(24);
        panel.addView(messageTitle, titleParams);

        messageBody = new TextView(this);
        messageBody.setText("Connecting to the hosted PAL service…");
        messageBody.setTextColor(Color.rgb(120, 139, 144));
        messageBody.setTextSize(13);
        messageBody.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams bodyParams = matchWrap();
        bodyParams.topMargin = dp(12);
        panel.addView(messageBody, bodyParams);

        retryButton = new Button(this);
        retryButton.setText("Retry connection");
        retryButton.setTextColor(BG);
        retryButton.setAllCaps(false);
        retryButton.setTextSize(14);
        retryButton.setBackground(roundDrawable(TEAL, dp(12)));
        retryButton.setOnClickListener(v -> loadHome());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-1, dp(50));
        buttonParams.topMargin = dp(24);
        buttonParams.leftMargin = dp(24);
        buttonParams.rightMargin = dp(24);
        panel.addView(retryButton, buttonParams);

        Button browserButton = new Button(this);
        browserButton.setText("Open in browser");
        browserButton.setTextColor(TEAL);
        browserButton.setAllCaps(false);
        browserButton.setBackground(roundDrawable(PANEL, dp(12)));
        browserButton.setOnClickListener(v -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(HOME)));
            } catch (ActivityNotFoundException ex) {
                Toast.makeText(this, "No browser is available.", Toast.LENGTH_SHORT).show();
            }
        });
        LinearLayout.LayoutParams browserParams = new LinearLayout.LayoutParams(-1, dp(46));
        browserParams.topMargin = dp(8);
        browserParams.leftMargin = dp(24);
        browserParams.rightMargin = dp(24);
        panel.addView(browserButton, browserParams);
        return panel;
    }

    private void showRetry(String title, String body) {
        messageTitle.setText(title);
        messageBody.setText(body);
        retryPanel.setVisibility(View.VISIBLE);
    }

    private GradientDrawable roundDrawable(int color, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(-1, -2);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(loadingDeadline);
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}

package com.ksaviation.admin;

import android.app.*;
import android.content.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

public class MonitorService extends Service {
    private static final String CH_SERVICE="ks_service";
    private static final String CH_ALERT="ks_alert";
    private final Handler h=new Handler(Looper.getMainLooper());
    private final Set<String> seen=new HashSet<>();
    private String pin="";

    @Override public void onCreate(){
        super.onCreate();
        createChannels();
        try{ pin=SecureStore.prefs(this).getString("admin_pin",""); }catch(Exception ignored){}
        Notification n=new NotificationCompat.Builder(this,CH_SERVICE)
                .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
                .setContentTitle("KS AVIATION")
                .setContentText("Misafir giriş kontrolü aktif")
                .setOngoing(true)
                .build();
        startForeground(1001,n);
        poll();
    }

    private void poll(){
        h.postDelayed(() -> {
            new Thread(() -> {
                try{
                    if(!pin.isEmpty()){
                        JSONArray a=Api.pending(pin);
                        for(int i=0;i<a.length();i++){
                            JSONObject x=a.getJSONObject(i);
                            if(!"pending".equals(x.optString("status"))) continue;
                            String id=x.optString("id");
                            if(seen.add(id)) notifyRequest(x);
                        }
                    }
                }catch(Exception ignored){}
                poll();
            }).start();
        },2500);
    }

    private void notifyRequest(JSONObject x){
        String name=x.optString("name","Misafir");
        Intent open=new Intent(this,MainActivity.class);
        PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);

        Notification n=new NotificationCompat.Builder(this,CH_ALERT)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("KS AVIATION - Giriş Talebi")
                .setContentText(name+" giriş izni istiyor")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setDefaults(Notification.DEFAULT_ALL)
                .build();
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(x.optString("id").hashCode(),n);
    }

    private void createChannels(){
        NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel service=new NotificationChannel(CH_SERVICE,"KS Aviation Servis",NotificationManager.IMPORTANCE_LOW);
        service.setDescription("Misafir giriş kontrolü arka plan bağlantısı");
        nm.createNotificationChannel(service);

        NotificationChannel alert=new NotificationChannel(CH_ALERT,"KS Aviation Giriş Talepleri",NotificationManager.IMPORTANCE_HIGH);
        alert.enableVibration(true);
        alert.setDescription("Yeni misafir giriş talepleri");
        nm.createNotificationChannel(alert);
    }

    @Override public int onStartCommand(Intent i,int flags,int id){ return START_STICKY; }
    @Override public android.os.IBinder onBind(Intent i){ return null; }
}

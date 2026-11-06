package com.ksaviation.admin;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {
    private EditText pin;
    private TextView status,list;
    private String savedPin="";

    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        setContentView(R.layout.activity_main);
        pin=findViewById(R.id.pin);
        status=findViewById(R.id.status);
        list=findViewById(R.id.list);
        Button connect=findViewById(R.id.connect);

        if(Build.VERSION.SDK_INT>=33 && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.POST_NOTIFICATIONS},10);
        }

        try{
            savedPin=SecureStore.prefs(this).getString("admin_pin","");
            if(!savedPin.isEmpty()) pin.setText(savedPin);
        }catch(Exception ignored){}

        connect.setOnClickListener(v -> {
            final String p=pin.getText().toString().trim();
            if(p.length()!=6){ Toast.makeText(this,"6 haneli PIN girin",Toast.LENGTH_SHORT).show(); return; }
            status.setText("Kontrol ediliyor...");
            new Thread(() -> {
                try{
                    Api.verify(p);
                    SecureStore.prefs(this).edit().putString("admin_pin",p).apply();
                    savedPin=p;
                    startForegroundService(new Intent(this,MonitorService.class));
                    runOnUiThread(() -> {status.setText("● BAĞLANDI - Arka plan servisi aktif"); refresh();});
                }catch(Exception e){
                    runOnUiThread(() -> status.setText("PIN hatalı veya bağlantı yok."));
                }
            }).start();
        });

        if(!savedPin.isEmpty()){
            startForegroundService(new Intent(this,MonitorService.class));
            status.setText("Servis başlatıldı.");
            refresh();
        }
    }

    private void refresh(){
        if(savedPin.isEmpty()) return;
        new Thread(() -> {
            try{
                JSONArray a=Api.pending(savedPin);
                StringBuilder sb=new StringBuilder();
                for(int i=0;i<a.length();i++){
                    JSONObject x=a.getJSONObject(i);
                    if(!"pending".equals(x.optString("status"))) continue;
                    sb.append("• ").append(x.optString("name"));
                    String company=x.optString("company");
                    if(!company.isEmpty()) sb.append(" / ").append(company);
                    sb.append("\n");
                }
                String out=sb.length()==0?"Bekleyen talep yok.":sb.toString();
                runOnUiThread(() -> list.setText(out));
            }catch(Exception e){
                runOnUiThread(() -> status.setText("Bağlantı hatası."));
            }
        }).start();
    }
}

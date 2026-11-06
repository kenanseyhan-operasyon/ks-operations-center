package com.ksaviation.admin;

import android.content.*;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent){
        try{
            String pin=SecureStore.prefs(context).getString("admin_pin","");
            if(!pin.isEmpty()) context.startForegroundService(new Intent(context,MonitorService.class));
        }catch(Exception ignored){}
    }
}

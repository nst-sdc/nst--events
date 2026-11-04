package expo.modules.inappupdates

import android.app.Activity
import android.content.Context
import android.os.Build
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallState
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlayInAppUpdatesModule : Module() {
  private var appUpdateManager: AppUpdateManager? = null
  private var cachedAppUpdateInfo: AppUpdateInfo? = null
  private var installStateListener: InstallStateUpdatedListener? = null

  companion object {
    const val UPDATE_REQUEST_CODE = 47823
  }

  @Synchronized
  private fun getAppUpdateManager(): AppUpdateManager? {
    if (appUpdateManager == null) {
      val context: Context = appContext.reactContext ?: return null
      try {
        val manager = AppUpdateManagerFactory.create(context)
        appUpdateManager = manager
        setupListener(manager)
      } catch (_: Exception) {
        return null
      }
    }
    return appUpdateManager
  }

  override fun definition() = ModuleDefinition {
    Name("PlayInAppUpdatesModule")

    Events("onUpdateDownloaded", "onUpdateProgress", "onUpdateCancelled", "onUpdateFailed")

    OnCreate {
      getAppUpdateManager()
    }

    OnDestroy {
      val manager = appUpdateManager
      installStateListener?.let { listener ->
        try {
          manager?.unregisterListener(listener)
        } catch (_: Exception) {}
      }
      installStateListener = null
      cachedAppUpdateInfo = null
      appUpdateManager = null
    }

    OnActivityEntersForeground {
      val manager = getAppUpdateManager() ?: return@OnActivityEntersForeground
      val activity = appContext.currentActivity ?: return@OnActivityEntersForeground
      if (activity.isFinishing || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed)) {
        return@OnActivityEntersForeground
      }

      try {
        manager.appUpdateInfo.addOnSuccessListener { info ->
          cachedAppUpdateInfo = info
          if (activity.isFinishing || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed)) {
            return@addOnSuccessListener
          }
          if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
            // Resume interrupted immediate update
            try {
              val options = AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
              manager.startUpdateFlowForResult(info, activity, options, UPDATE_REQUEST_CODE)
            } catch (_: Exception) {}
          } else if (info.installStatus() == InstallStatus.DOWNLOADED) {
            try {
              sendEvent("onUpdateDownloaded", mapOf("readyToInstall" to true))
            } catch (_: Exception) {}
          }
        }
      } catch (_: Exception) {}
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == UPDATE_REQUEST_CODE) {
        when (payload.resultCode) {
          Activity.RESULT_OK -> {
            // Update flow accepted or completed
          }
          Activity.RESULT_CANCELED -> {
            try {
              sendEvent("onUpdateCancelled", mapOf("reason" to "USER_CANCELLED"))
            } catch (_: Exception) {}
          }
          else -> {
            try {
              sendEvent("onUpdateFailed", mapOf("resultCode" to payload.resultCode))
            } catch (_: Exception) {}
          }
        }
      }
    }

    AsyncFunction("checkForUpdate") { promise: Promise ->
      val manager = getAppUpdateManager() ?: run {
        promise.resolve(mapOf(
          "updateAvailable" to false,
          "isPlayStoreInstall" to false,
          "reason" to "PLAY_CORE_UNAVAILABLE"
        ))
        return@AsyncFunction
      }

      val context = appContext.reactContext
      val isPlayInstall = isInstalledViaGooglePlay(context)

      try {
        manager.appUpdateInfo.addOnSuccessListener { info ->
          cachedAppUpdateInfo = info
          val isAvailable = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
          val isUpdateInProgress = info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS

          val flexibleAllowed = info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
          val immediateAllowed = info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
          val staleness = info.clientVersionStalenessDays()

          promise.resolve(mapOf(
            "updateAvailable" to (isAvailable || isUpdateInProgress),
            "updateInProgress" to isUpdateInProgress,
            "versionCode" to info.availableVersionCode(),
            "flexibleAllowed" to flexibleAllowed,
            "immediateAllowed" to immediateAllowed,
            "clientVersionStalenessDays" to staleness,
            "updatePriority" to info.updatePriority(),
            "installStatus" to info.installStatus(),
            "isPlayStoreInstall" to isPlayInstall
          ))
        }.addOnFailureListener { error ->
          promise.resolve(mapOf(
            "updateAvailable" to false,
            "isPlayStoreInstall" to isPlayInstall,
            "error" to (error.message ?: "Check failed")
          ))
        }
      } catch (e: Exception) {
        promise.resolve(mapOf(
          "updateAvailable" to false,
          "isPlayStoreInstall" to isPlayInstall,
          "error" to (e.message ?: "Check failed")
        ))
      }
    }

    AsyncFunction("startFlexibleUpdate") { promise: Promise ->
      val manager = getAppUpdateManager() ?: run {
        promise.reject("ERR_NOT_AVAILABLE", "Play Core is not available on this device", null)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity ?: run {
        promise.reject("ERR_NO_ACTIVITY", "Current activity is null", null)
        return@AsyncFunction
      }
      if (activity.isFinishing || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed)) {
        promise.reject("ERR_ACTIVITY_DESTROYED", "Activity is finishing or destroyed", null)
        return@AsyncFunction
      }

      fun triggerFlexibleFlow(info: AppUpdateInfo) {
        cachedAppUpdateInfo = info
        if (!info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
          promise.reject("ERR_NOT_ALLOWED", "Flexible update is not allowed for this update", null)
          return
        }
        try {
          val options = AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build()
          manager.startUpdateFlowForResult(info, activity, options, UPDATE_REQUEST_CODE)
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("ERR_START_UPDATE", e.message, e)
        }
      }

      val cached = cachedAppUpdateInfo
      if (cached != null) {
        triggerFlexibleFlow(cached)
      } else {
        manager.appUpdateInfo.addOnSuccessListener { freshInfo ->
          triggerFlexibleFlow(freshInfo)
        }.addOnFailureListener { error ->
          promise.reject("ERR_FETCH_INFO", error.message, error)
        }
      }
    }

    AsyncFunction("startImmediateUpdate") { promise: Promise ->
      val manager = getAppUpdateManager() ?: run {
        promise.reject("ERR_NOT_AVAILABLE", "Play Core is not available on this device", null)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity ?: run {
        promise.reject("ERR_NO_ACTIVITY", "Current activity is null", null)
        return@AsyncFunction
      }
      if (activity.isFinishing || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed)) {
        promise.reject("ERR_ACTIVITY_DESTROYED", "Activity is finishing or destroyed", null)
        return@AsyncFunction
      }

      fun triggerImmediateFlow(info: AppUpdateInfo) {
        cachedAppUpdateInfo = info
        if (!info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
          promise.reject("ERR_NOT_ALLOWED", "Immediate update is not allowed for this update", null)
          return
        }
        try {
          val options = AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
          manager.startUpdateFlowForResult(info, activity, options, UPDATE_REQUEST_CODE)
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("ERR_START_UPDATE", e.message, e)
        }
      }

      val cached = cachedAppUpdateInfo
      if (cached != null) {
        triggerImmediateFlow(cached)
      } else {
        manager.appUpdateInfo.addOnSuccessListener { freshInfo ->
          triggerImmediateFlow(freshInfo)
        }.addOnFailureListener { error ->
          promise.reject("ERR_FETCH_INFO", error.message, error)
        }
      }
    }

    AsyncFunction("completeUpdate") { promise: Promise ->
      val manager = getAppUpdateManager() ?: run {
        promise.reject("ERR_NOT_AVAILABLE", "Play Core is not available", null)
        return@AsyncFunction
      }
      try {
        manager.completeUpdate().addOnSuccessListener {
          promise.resolve(true)
        }.addOnFailureListener { err ->
          promise.reject("ERR_COMPLETE_UPDATE", err.message, err)
        }
      } catch (e: Exception) {
        promise.reject("ERR_COMPLETE_UPDATE", e.message, e)
      }
    }
  }

  @Synchronized
  private fun setupListener(manager: AppUpdateManager) {
    if (installStateListener != null) return
    val listener = InstallStateUpdatedListener { state: InstallState ->
      try {
        when (state.installStatus()) {
          InstallStatus.DOWNLOADED -> {
            sendEvent("onUpdateDownloaded", mapOf("readyToInstall" to true))
          }
          InstallStatus.DOWNLOADING -> {
            sendEvent("onUpdateProgress", mapOf(
              "bytesDownloaded" to state.bytesDownloaded(),
              "totalBytesToDownload" to state.totalBytesToDownload()
            ))
          }
          InstallStatus.FAILED -> {
            sendEvent("onUpdateFailed", mapOf("errorCode" to state.installErrorCode()))
          }
          InstallStatus.CANCELED -> {
            sendEvent("onUpdateCancelled", mapOf("reason" to "INSTALL_CANCELED"))
          }
          else -> {}
        }
      } catch (_: Exception) {}
    }
    installStateListener = listener
    try {
      manager.registerListener(listener)
    } catch (_: Exception) {}
  }

  private fun isInstalledViaGooglePlay(context: Context?): Boolean {
    if (context == null) return false
    return try {
      val pm = context.packageManager
      val packageName = context.packageName
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val info = pm.getInstallSourceInfo(packageName)
        val installer = info.installingPackageName
        val initiator = info.initiatingPackageName
        installer == "com.android.vending" || initiator == "com.android.vending"
      } else {
        @Suppress("DEPRECATION")
        val installer = pm.getInstallerPackageName(packageName)
        installer == "com.android.vending"
      }
    } catch (_: Exception) {
      false
    }
  }
}

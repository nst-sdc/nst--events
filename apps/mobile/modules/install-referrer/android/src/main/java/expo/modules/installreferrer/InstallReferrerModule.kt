package expo.modules.installreferrer

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.android.installreferrer.api.ReferrerDetails
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class InstallReferrerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InstallReferrerModule")

    AsyncFunction("getInstallReferrer") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.resolve(null)
        return@AsyncFunction
      }

      try {
        val referrerClient = InstallReferrerClient.newBuilder(context).build()
        referrerClient.startConnection(object : InstallReferrerStateListener {
          override fun onInstallReferrerSetupFinished(responseCode: Int) {
            when (responseCode) {
              InstallReferrerClient.InstallReferrerResponse.OK -> {
                try {
                  val response: ReferrerDetails = referrerClient.installReferrer
                  val map = mapOf(
                    "installReferrer" to response.installReferrer,
                    "referrerClickTimestampSeconds" to response.referrerClickTimestampSeconds.toDouble(),
                    "installBeginTimestampSeconds" to response.installBeginTimestampSeconds.toDouble(),
                    "googlePlayInstant" to response.googlePlayInstantParam
                  )
                  promise.resolve(map)
                } catch (e: Exception) {
                  promise.reject("ERR_REFERRER_DETAILS", e.message, e)
                } finally {
                  try {
                    referrerClient.endConnection()
                  } catch (_: Exception) {}
                }
              }
              InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED,
              InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE -> {
                try {
                  referrerClient.endConnection()
                } catch (_: Exception) {}
                promise.resolve(null)
              }
              else -> {
                try {
                  referrerClient.endConnection()
                } catch (_: Exception) {}
                promise.resolve(null)
              }
            }
          }

          override fun onInstallReferrerServiceDisconnected() {
            // Handled gracefully on service disconnect
          }
        })
      } catch (e: Exception) {
        promise.reject("ERR_INSTALL_REFERRER", e.message, e)
      }
    }
  }
}


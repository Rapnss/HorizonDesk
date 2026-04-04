import threading
try:
    from win10toast import ToastNotifier
except ImportError:
    ToastNotifier = None

class NotificationManager:
    def __init__(self):
        self.toaster = ToastNotifier() if ToastNotifier else None

    def show_toast(self, title, message, icon_path=None, duration=5, threaded=True):
        """Displays a native Windows toast notification."""
        if not self.toaster:
            print(f"[Notification] NativeToast not available. Title: {title}, Msg: {message}")
            return
            
        try:
            if threaded:
                # Use a thread to avoid blocking the main bridge process
                thread = threading.Thread(
                    target=self.toaster.show_toast,
                    args=(title, message),
                    kwargs={
                        "icon_path": icon_path,
                        "duration": duration,
                        "threaded": False # The thread itself handles the block
                    }
                )
                thread.daemon = True
                thread.start()
            else:
                self.toaster.show_toast(title, message, icon_path=icon_path, duration=duration)
        except Exception as e:
            print(f"[Notification] Error showing toast: {e}")

# Global instance
notification_manager = NotificationManager()

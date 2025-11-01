"""
Utilities for managing Django signals during bulk operations
"""
from contextlib import contextmanager
from django.db.models.signals import post_save, post_delete, pre_save, pre_delete


@contextmanager
def disable_signals():
    """
    Context manager to temporarily disable all signals during bulk operations
    
    Usage:
        with disable_signals():
            SalaryData.objects.bulk_create(records, batch_size=100)
    
    This prevents N signal calls during bulk operations, significantly improving performance.
    """
    # Store original signal receivers
    saved_receivers = {}
    
    for signal in [post_save, post_delete, pre_save, pre_delete]:
        saved_receivers[signal] = signal.receivers
        signal.receivers = []
    
    try:
        yield
    finally:
        # Restore original signal receivers
        for signal, receivers in saved_receivers.items():
            signal.receivers = receivers


@contextmanager
def disable_signal_for_model(model, signal_type=post_save):
    """
    Context manager to temporarily disable a specific signal for a specific model
    
    Usage:
        with disable_signal_for_model(SalaryData, post_save):
            SalaryData.objects.bulk_create(records, batch_size=100)
    
    Args:
        model: Django model class (e.g., SalaryData)
        signal_type: Signal to disable (post_save, post_delete, etc.)
    """
    # Find and disconnect receivers for this model
    receivers_to_restore = []
    
    for receiver in signal_type.receivers:
        # Check if this receiver is for our model
        if len(receiver) >= 2:
            receiver_func = receiver[1]
            # Check if receiver has sender check
            if hasattr(receiver_func, '__self__'):
                continue
            # Store and disconnect
            receivers_to_restore.append(receiver)
    
    # Disconnect
    for receiver in receivers_to_restore:
        if len(receiver) >= 2:
            signal_type.disconnect(receiver[1], sender=model)
    
    try:
        yield
    finally:
        # Reconnect
        for receiver in receivers_to_restore:
            if len(receiver) >= 2:
                signal_type.connect(receiver[1], sender=model)


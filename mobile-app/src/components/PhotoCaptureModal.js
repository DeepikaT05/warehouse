import React, { useState, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS } from '../theme';

export default function PhotoCaptureModal({ visible, onClose, onPhotoCaptured, title = '📷 Capture Goods Photo Proof' }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);

  if (!visible) return null;

  const handleSnap = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true
      });
      
      const photoData = photo.base64 
        ? `data:image/jpeg;base64,${photo.base64}` 
        : photo.uri;

      onPhotoCaptured(photoData);
    } catch (err) {
      console.error('Camera snap error:', err);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header bar */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        {/* Camera Area */}
        <View style={styles.cameraContainer}>
          {!permission ? (
            <View style={styles.centerView}>
              <Text style={styles.infoText}>Checking camera permissions...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={styles.centerView}>
              <Text style={styles.infoText}>Camera permission is required to capture goods photo proof.</Text>
              <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                <Text style={styles.permBtnText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                facing="back"
              />

              {/* Bottom Controls */}
              <View style={styles.bottomControls}>
                <Text style={styles.hintText}>Point at loaded boxes / vehicle and snap photo</Text>
                <TouchableOpacity 
                  style={[styles.captureBtn, capturing && { opacity: 0.6 }]} 
                  onPress={handleSnap}
                  disabled={capturing}
                >
                  {capturing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <View style={styles.captureInnerCircle}>
                      <Text style={styles.snapIcon}>📸</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    height: 60,
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  closeBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  cameraContainer: { flex: 1 },
  centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  infoText: { color: '#FFF', fontSize: 14, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  permBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden'
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF'
  },
  snapIcon: {
    fontSize: 26
  }
});

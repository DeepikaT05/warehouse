 import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS } from '../theme';

export default function QRScannerModal({ visible, onClose, onScan }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!visible) return null;

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    if (onScan) {
      onScan(data);
    }
    // Allow re-scan after 1.5 seconds if modal stays open
    setTimeout(() => setScanned(false), 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header bar */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📷 Live Camera QR Scanner</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        {/* Camera View Area */}
        <View style={styles.cameraContainer}>
          {!permission ? (
            <View style={styles.centerView}>
              <Text style={styles.infoText}>Checking camera permissions...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={styles.centerView}>
              <Text style={styles.infoText}>Camera access is needed to scan QR Code labels.</Text>
              <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                <Text style={styles.permBtnText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, position: 'relative' }}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              />

              {/* Targeting Overlay Frame */}
              <View style={styles.overlayContainer}>
                <View style={styles.viewfinder}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.instructionText}>Align QR Code inside frame to verify</Text>
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
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  closeBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  cameraContainer: { flex: 1 },
  centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  infoText: { color: '#FFF', fontSize: 14, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  permBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 16,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: COLORS.primary,
  },
  topLeft: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  topRight: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  instructionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
});

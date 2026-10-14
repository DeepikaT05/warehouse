import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import mobileApi, { errorMessage } from '../services/api';
import NavigationMenuModal from '../components/NavigationMenuModal';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 10;

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    totalStock: 0,
    todayDispatches: 0,
    availableStock: 0,
    pendingDispatches: 0
  });

  const [assignedBills, setAssignedBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  // Pagination & In-Memory Caching State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBillsCount, setTotalBillsCount] = useState(0);
  const pageCacheRef = useRef({});

  const fetchMetrics = async () => {
    try {
      const res = await mobileApi.get('/stock/dashboard');
      if (res.data?.success && res.data.metrics) {
        setMetrics(res.data.metrics);
      }
    } catch (err) {
      console.warn('[Dashboard] Metrics fetch error:', err.message);
    }
  };

  const fetchBillsPage = async (pageToFetch = 1, forceRefresh = false) => {
    // Check in-memory page cache first for instant page switching
    if (!forceRefresh && pageCacheRef.current[pageToFetch]) {
      console.log(`[Dashboard] Loading page ${pageToFetch} from cache`);
      setAssignedBills(pageCacheRef.current[pageToFetch].orders);
      setTotalPages(pageCacheRef.current[pageToFetch].totalPages || 1);
      setTotalBillsCount(pageCacheRef.current[pageToFetch].total || 0);
      setCurrentPage(pageToFetch);
      setBillsLoading(false);
      return;
    }

    setBillsLoading(true);
    setLoadError('');

    try {
      console.log(`[Dashboard] Fetching page ${pageToFetch} from backend API (limit=${PAGE_SIZE})`);
      const res = await mobileApi.get('/user/orders', {
        params: {
          limit: PAGE_SIZE,
          page: pageToFetch
        }
      });

      if (res.data?.success) {
        const orders = res.data.orders || [];
        const pagination = res.data.pagination || {};
        const total = pagination.total ?? orders.length;
        const totalP = pagination.totalPages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));

        // Save to cache
        pageCacheRef.current[pageToFetch] = {
          orders,
          total,
          totalPages: totalP,
          timestamp: Date.now()
        };

        setAssignedBills(orders);
        setTotalPages(totalP);
        setTotalBillsCount(total);
        setCurrentPage(pageToFetch);
      } else {
        setLoadError(res.data?.message || 'Failed to load assigned bills.');
      }
    } catch (err) {
      console.error(`[Dashboard] Page ${pageToFetch} fetch error:`, err);
      setLoadError(errorMessage(err, 'Could not connect to server.'));
    } finally {
      setBillsLoading(false);
      setRefreshing(false);
    }
  };

  // Full Refresh (pull down or screen focus)
  const handleFullRefresh = async () => {
    setRefreshing(true);
    // Invalidate cache on manual refresh
    pageCacheRef.current = {};
    await Promise.all([fetchMetrics(), fetchBillsPage(1, true)]);
  };

  useFocusEffect(
    useCallback(() => {
      fetchMetrics();
      pageCacheRef.current = {};
      fetchBillsPage(currentPage, true);
    }, [currentPage])
  );

  const handlePageChange = (targetPage) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === currentPage) return;
    fetchBillsPage(targetPage, false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleFullRefresh}
            colors={['#0F6E56']}
            tintColor="#0F6E56"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>VANIKI CROP SCIENCE</Text>
            <Text style={styles.userName}>{user?.name || 'Warehouse Operator'}</Text>
            <Text style={styles.roleSubtext}>Live Inventory & Dispatch Guard</Text>
          </View>

          {/* 3-Line Hamburger Menu Bar Button */}
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.hamburgerIcon}>{'\u2261'}</Text>
            <Text style={styles.hamburgerText}>MENU</Text>
          </TouchableOpacity>
        </View>

        {/* Warehouse Metrics Snapshot */}
        <View style={styles.metricsHeaderRow}>
          <Text style={styles.sectionTitle}>WAREHOUSE SNAPSHOT</Text>
          <TouchableOpacity onPress={fetchMetrics}>
            <Text style={styles.refreshIconText}>🔄 Sync</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <View style={[styles.metricCard, styles.metricBorderBlue]}>
            <Text style={styles.metricLabel}>Total Boxes</Text>
            <Text style={styles.metricValue}>{metrics.totalStock}</Text>
            <Text style={styles.metricSub}>In Warehouse</Text>
          </View>

          <View style={[styles.metricCard, styles.metricBorderGreen]}>
            <Text style={styles.metricLabel}>Today Dispatched</Text>
            <Text style={[styles.metricValue, { color: '#059669' }]}>{metrics.todayDispatches}</Text>
            <Text style={styles.metricSub}>Boxes Shipped</Text>
          </View>

          <View style={[styles.metricCard, styles.metricBorderEmerald]}>
            <Text style={styles.metricLabel}>Available Stock</Text>
            <Text style={[styles.metricValue, { color: '#0F6E56' }]}>{metrics.availableStock}</Text>
            <Text style={styles.metricSub}>Ready for Picking</Text>
          </View>

          <View style={[styles.metricCard, styles.metricBorderAmber]}>
            <Text style={styles.metricLabel}>Pending Dispatch</Text>
            <Text style={[styles.metricValue, { color: '#D97706' }]}>{metrics.pendingDispatches}</Text>
            <Text style={styles.metricSub}>Awaiting Loading</Text>
          </View>
        </View>

        {/* ASSIGNED BILLS FOR WORKER STOCK PICKING SECTION */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>ASSIGNED BILLS FOR STOCK PICKING</Text>
            <Text style={styles.paginationSummary}>
              {totalBillsCount > 0
                ? `Showing Page ${currentPage} of ${totalPages} (${totalBillsCount} Active Bills)`
                : 'No active bills pending dispatch'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.viewAllBadge}
            onPress={() => navigation.navigate('AssignedOrders')}
          >
            <Text style={styles.viewAllText}>All Bills ({totalBillsCount}) →</Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {billsLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0F6E56" />
            <Text style={styles.loadingSubtext}>Loading Page {currentPage} bills...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Connection / Server Notice</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchBillsPage(currentPage, true)}
            >
              <Text style={styles.retryBtnText}>🔄 Retry Loading</Text>
            </TouchableOpacity>
          </View>
        ) : assignedBills.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>All Bills Picked & Dispatched</Text>
            <Text style={styles.emptyText}>
              There are no pending stock picking bills in the active queue right now.
              All completed and dispatched bills are safely archived in History.
            </Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleFullRefresh}
            >
              <Text style={styles.refreshBtnText}>🔄 Refresh Queue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Bills Cards List (Max 10 per page) */}
            {assignedBills.map((bill) => {
              const totalRequired =
                bill.totalBoxes ||
                bill.items?.reduce((acc, i) => acc + (i.totalBoxes || 1), 0) ||
                0;
              const totalPicked = bill.pickedItems?.length || 0;
              const isCompleted = totalPicked >= totalRequired && totalRequired > 0;
              const percent = totalRequired > 0 ? Math.min(100, Math.round((totalPicked / totalRequired) * 100)) : 0;

              return (
                <View key={bill._id} style={styles.billCard}>
                  {/* Bill Card Header */}
                  <View style={styles.billCardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.billNoText}>Bill #{bill.invoiceNo}</Text>
                        {bill.isB2BOrder && (
                          <View style={styles.b2bTag}>
                            <Text style={styles.b2bTagText}>B2B</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.dealerName}>{bill.dealerName || 'Dealer Store'}</Text>
                      {bill.garageName && bill.garageName !== bill.dealerName ? (
                        <Text style={styles.garageName}>📍 {bill.garageName}</Text>
                      ) : null}
                    </View>

                    <View style={[styles.statusBadge, isCompleted ? styles.badgeSuccess : styles.badgePending]}>
                      <Text style={[styles.statusBadgeText, isCompleted ? styles.badgeSuccessText : styles.badgePendingText]}>
                        {isCompleted ? '✓ PICKED' : bill.orderStatus?.toUpperCase() || 'NEW'}
                      </Text>
                    </View>
                  </View>

                  {/* Items Summary with explicit Packing Size */}
                  <View style={styles.itemsSummaryBox}>
                    <Text style={styles.itemsSummaryHeader}>
                      ITEMS ({bill.items?.length || 0}) • {totalRequired} BOXES:
                    </Text>
                    {bill.items?.map((p, idx) => {
                      const dispName =
                        p.displayProductName ||
                        (p.weight && !p.productName?.toUpperCase().includes(p.weight.toUpperCase())
                          ? `${p.productName} (${p.weight})`
                          : p.productName);

                      return (
                        <View key={idx} style={styles.itemRow}>
                          <Text style={styles.itemBullet}>•</Text>
                          <Text style={styles.itemSummaryText}>
                            <Text style={styles.itemNameBold}>{dispName}</Text>
                            {p.batchNumber ? (
                              <Text style={styles.batchTag}> [{p.batchNumber}]</Text>
                            ) : null}
                            {' — '}
                            <Text style={styles.qtyText}>
                              {p.totalBoxes || 1} Peti ({p.quantity} pcs)
                            </Text>
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Progress Bar & Action */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                    </View>
                  </View>

                  <View style={styles.billCardFooter}>
                    <Text style={styles.progressLabel}>
                      Picked: <Text style={{ color: '#0F6E56', fontWeight: '900' }}>{totalPicked}</Text> / {totalRequired} boxes ({percent}%)
                    </Text>

                    <TouchableOpacity
                      style={[styles.pickBtn, isCompleted && styles.pickBtnDone]}
                      onPress={() =>
                        navigation.navigate('ScanVerify', {
                          invoiceNo: bill.invoiceNo,
                          orderId: bill._id
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pickBtnText}>
                        {isCompleted ? '✓ Verify & Dispatch' : 'Start Picking & Scan ➔'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Pagination Controls (Pages 1, 2, 3...) */}
            {totalPages > 1 && (
              <View style={styles.paginationBox}>
                <TouchableOpacity
                  style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]}
                  onPress={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <Text style={[styles.pageNavText, currentPage === 1 && styles.pageNavTextDisabled]}>
                    ← Prev
                  </Text>
                </TouchableOpacity>

                <View style={styles.pageNumbersRow}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    const isActive = pageNum === currentPage;
                    return (
                      <TouchableOpacity
                        key={pageNum}
                        style={[styles.pagePill, isActive && styles.pagePillActive]}
                        onPress={() => handlePageChange(pageNum)}
                      >
                        <Text style={[styles.pagePillText, isActive && styles.pagePillTextActive]}>
                          {pageNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]}
                  onPress={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <Text style={[styles.pageNavText, currentPage === totalPages && styles.pageNavTextDisabled]}>
                    Next →
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* 3-LINE NAVIGATION HAMBURGER MENU MODAL */}
      <NavigationMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
        user={user}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 16, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  brandTitle: { fontSize: 11, color: '#0F6E56', fontWeight: '900', letterSpacing: 0.8 },
  userName: { fontSize: 19, color: '#0F172A', fontWeight: '900', marginTop: 1 },
  roleSubtext: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 1 },
  hamburgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F6E56',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#0F6E56',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3
  },
  hamburgerIcon: { fontSize: 18, color: '#FFFFFF', fontWeight: '900' },
  hamburgerText: { fontSize: 11, color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.5 },

  // Metrics Section
  metricsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#475569', letterSpacing: 0.5 },
  refreshIconText: { fontSize: 11, color: '#0F6E56', fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  metricBorderBlue: { borderLeftWidth: 4, borderLeftColor: '#2563EB' },
  metricBorderGreen: { borderLeftWidth: 4, borderLeftColor: '#059669' },
  metricBorderEmerald: { borderLeftWidth: 4, borderLeftColor: '#0F6E56' },
  metricBorderAmber: { borderLeftWidth: 4, borderLeftColor: '#D97706' },
  metricLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', textTransform: 'uppercase' },
  metricValue: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 3 },
  metricSub: { fontSize: 9, color: '#94A3B8', fontWeight: '700', marginTop: 2 },

  // Assigned Bills Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    marginTop: 4
  },
  paginationSummary: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 2 },
  viewAllBadge: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  viewAllText: { fontSize: 11, fontWeight: '800', color: '#0F6E56' },

  // States
  loadingBox: { padding: 36, alignItems: 'center' },
  loadingSubtext: { fontSize: 12, color: '#64748B', marginTop: 10, fontWeight: '700' },
  errorCard: {
    backgroundColor: '#FFF1F2',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
    marginVertical: 10
  },
  errorTitle: { fontSize: 13, fontWeight: '900', color: '#BE123C', marginBottom: 4 },
  errorText: { fontSize: 11, color: '#9F1239', textAlign: 'center', lineHeight: 16 },
  retryBtn: {
    marginTop: 10,
    backgroundColor: '#BE123C',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginVertical: 10
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  emptyText: { fontSize: 11, color: '#64748B', textAlign: 'center', lineHeight: 17, paddingHorizontal: 10 },
  refreshBtn: {
    marginTop: 14,
    backgroundColor: '#0F6E56',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10
  },
  refreshBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },

  // Bill Card
  billCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2
  },
  billCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  billNoText: { fontSize: 15, fontWeight: '900', color: '#0F6E56', fontFamily: 'monospace' },
  b2bTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#C7D2FE'
  },
  b2bTagText: { fontSize: 9, fontWeight: '900', color: '#4338CA' },
  dealerName: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  garageName: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgePendingText: { color: '#92400E', fontSize: 9, fontWeight: '900' },
  badgeSuccess: { backgroundColor: '#D1FAE5' },
  badgeSuccessText: { color: '#065F46', fontSize: 9, fontWeight: '900' },

  // Items Summary
  itemsSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  itemsSummaryHeader: { fontSize: 9, fontWeight: '900', color: '#64748B', marginBottom: 4, letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 },
  itemBullet: { color: '#0F6E56', marginRight: 6, fontWeight: '900', fontSize: 12 },
  itemSummaryText: { fontSize: 11, color: '#334155', flex: 1, lineHeight: 16 },
  itemNameBold: { fontWeight: '800', color: '#0F172A' },
  batchTag: { fontSize: 10, color: '#059669', fontWeight: '800' },
  qtyText: { fontWeight: '900', color: '#0F6E56' },

  // Progress Bar
  progressContainer: { marginVertical: 4 },
  progressBarBg: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#0F6E56', borderRadius: 2 },

  // Card Footer
  billCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  progressLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },
  pickBtn: {
    backgroundColor: '#0F6E56',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#0F6E56',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2
  },
  pickBtnDone: { backgroundColor: '#059669' },
  pickBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },

  // Pagination Controls
  paginationBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  pageNavBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  pageNavBtnDisabled: { opacity: 0.4 },
  pageNavText: { fontSize: 11, fontWeight: '800', color: '#0F6E56' },
  pageNavTextDisabled: { color: '#94A3B8' },
  pageNumbersRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  pagePill: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pagePillActive: {
    backgroundColor: '#0F6E56',
    borderColor: '#0F6E56'
  },
  pagePillText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  pagePillTextActive: { color: '#FFFFFF' }
});

// app/schedule.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker, { Event } from '@react-native-community/datetimepicker';

type RowLabelProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  editable?: boolean;
};

const RowLabel: React.FC<RowLabelProps> = ({ label, value, onPress, editable = true }) => {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={editable && onPress ? 0.7 : 1}
      disabled={!editable || !onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {editable && <FontAwesome5 name="chevron-right" size={14} color="#94a3b8" />}
    </TouchableOpacity>
  );
};

const REPEAT_OPTIONS = [
  'None',
  'Every day',
  'Every week',
  'Every 2 weeks',
  'Every month',
  'Every year',
];

const TIMEZONES = [
  // representative subset — extend as needed
  'GMT-11:00 Midway Island',
  'GMT-11:00 Pago Pago',
  'GMT-10:00 Hawaii',
  'GMT-08:00 Alaska',
  'GMT-07:00 Pacific Time (US and Canada)',
  'GMT-07:00 Arizona',
  'GMT-06:00 Mountain Time (US and Canada)',
  'GMT-06:00 Yukon',
  'GMT-05:00 Central Time (US and Canada)',
  'GMT-04:00 Atlantic Time (Canada)',
  'GMT+00:00 UTC',
  'GMT+05:30 Asia/Kolkata',
  'GMT+09:00 Tokyo',
  'GMT+10:00 Sydney',
  'GMT+12:00 Auckland',
];

export default function ScheduleScreen() {
  const router = useRouter();

  // Meeting details
  const [meetingTopic, setMeetingTopic] = useState("sankha subhra das's Zoom Meeting");

  // store date as Date object (so calendar/date picker works)
  const [date, setDate] = useState<Date>(() => {
    const d = new Date('2025-09-10T00:00:00');
    return d;
  });

  // store time as Date objects for From & To
  const initialFrom = new Date();
  initialFrom.setHours(19, 0, 0, 0);
  const initialTo = new Date();
  initialTo.setHours(19, 30, 0, 0);

  const [fromTime, setFromTime] = useState<Date>(initialFrom);
  const [toTime, setToTime] = useState<Date>(initialTo);
  const [timezone, setTimezone] = useState('GMT+05:30 Asia/Kolkata');

  // toggles
  const [usePMI, setUsePMI] = useState(false);
  const [requirePasscode, setRequirePasscode] = useState(true);
  const [enableWaitingRoom, setEnableWaitingRoom] = useState(true);
  const [onlyAuthenticatedUsers, setOnlyAuthenticatedUsers] = useState(false);

  const [continuousChat, setContinuousChat] = useState(true);
  const [hostVideo, setHostVideo] = useState(false);
  const [participantVideo, setParticipantVideo] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(true);

  const personalMeetingId = useMemo(() => '873 448 2461', []);
  const [passcode, setPasscode] = useState(generatePasscode());

  // Invitees
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteeInput, setInviteeInput] = useState('');
  const [invitees, setInvitees] = useState<string[]>([]);

  // Edit field modal (topic only)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Repeat modal
  const [repeatModalVisible, setRepeatModalVisible] = useState(false);
  const [repeatOption, setRepeatOption] = useState(REPEAT_OPTIONS[0]);

  // Timezone modal
  const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);

  // Date/timepicker visibility & mode
  const [showDatePicker, setShowDatePicker] = useState(false); // calendar for Date
  const [showFromPicker, setShowFromPicker] = useState(false); // time picker for From
  const [showToPicker, setShowToPicker] = useState(false); // time picker for To

  // helpers to open editors
  function openEditTopic() {
    setEditValue(meetingTopic);
    setEditModalVisible(true);
  }

  function saveEditTopic() {
    setMeetingTopic(editValue || meetingTopic);
    setEditModalVisible(false);
    setEditValue('');
  }

  // invitee helpers
  function addInvitee() {
    const v = inviteeInput.trim();
    if (!v) {
      Alert.alert('Enter invitee', 'Please type an email or name to add.');
      return;
    }
    setInvitees((p) => [...p, v]);
    setInviteeInput('');
  }
  function removeInvitee(idx: number) {
    setInvitees((p) => p.filter((_, i) => i !== idx));
  }

  // toggle passcode behavior
  function toggleRequirePasscode(val: boolean) {
    setRequirePasscode(val);
    if (val && !passcode) setPasscode(generatePasscode());
  }

  // formats
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatTime = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const hh = pad(h);
    const mm = pad(m);
    return `${hh}:${mm}`;
  };
  const formatDate = (d: Date) => {
    // show friendly date like YYYY-MM-DD (you can replace with locale formatting)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // handle onDone
  function onDone() {
    // basic validation: ensure from < to (compare times on same day)
    const fromMillis = new Date(date);
    fromMillis.setHours(fromTime.getHours(), fromTime.getMinutes(), 0, 0);
    const toMillis = new Date(date);
    toMillis.setHours(toTime.getHours(), toTime.getMinutes(), 0, 0);

    if (fromMillis.getTime() >= toMillis.getTime()) {
      Alert.alert('Time error', 'Start time must be before end time.');
      return;
    }

    if (requirePasscode && !passcode.trim()) {
      Alert.alert('Passcode required', 'Please set a passcode or disable the passcode requirement.');
      return;
    }

    const payload = {
      topic: meetingTopic,
      date: formatDate(date),
      from: formatTime(fromTime),
      to: formatTime(toTime),
      timezone,
      repeat: repeatOption,
      usePMI,
      personalMeetingId: usePMI ? personalMeetingId : undefined,
      requirePasscode,
      passcode: requirePasscode ? passcode : undefined,
      enableWaitingRoom,
      onlyAuthenticatedUsers,
      continuousChat,
      hostVideo,
      participantVideo,
      invitees,
      addToCalendar,
    };

    console.log('Scheduling', payload);
    Alert.alert('Meeting scheduled', `Your meeting on ${formatDate(date)} at ${formatTime(fromTime)} has been scheduled.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  // DateTimePicker handlers
  const onDateChange = (event: Event, selected?: Date | undefined) => {
    // On Android, picker closes automatically and event.type indicates set/dismissed
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    // Guard: selected undefined when dismissed
    if (selected) setDate(selected);
  };

  const onFromChange = (event: Event, selected?: Date | undefined) => {
    if (Platform.OS !== 'ios') setShowFromPicker(false);
    if (selected) setFromTime(selected);
  };
  const onToChange = (event: Event, selected?: Date | undefined) => {
    if (Platform.OS !== 'ios') setShowToPicker(false);
    if (selected) setToTime(selected);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.headerAction}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedule meeting</Text>
          <TouchableOpacity onPress={onDone}>
            <Text style={styles.headerAction}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>Your scheduling settings have been synced from your Zoom web portal</Text>
          </View>

          <View style={styles.card}>
            {/* Topic */}
            <TouchableOpacity style={styles.row} onPress={openEditTopic}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{meetingTopic}</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={14} color="#94a3b8" />
            </TouchableOpacity>

            <View style={styles.sectionDivider} />

            {/* Date - opens calendar/date picker */}
            <RowLabel label="Date" value={formatDate(date)} onPress={() => setShowDatePicker(true)} />

            {/* From and To (open clock UI) */}
            <TouchableOpacity style={styles.row} onPress={() => setShowFromPicker(true)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>From</Text>
                <Text style={styles.rowValue}>{formatTime(fromTime)}</Text>
              </View>
              <FontAwesome5 name="clock" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={() => setShowToPicker(true)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>To</Text>
                <Text style={styles.rowValue}>{formatTime(toTime)}</Text>
              </View>
              <FontAwesome5 name="clock" size={18} color="#94a3b8" />
            </TouchableOpacity>

            {/* Repeat option (opens radio list modal) */}
            <RowLabel label="Repeat" value={repeatOption} onPress={() => setRepeatModalVisible(true)} />

            <RowLabel label="Time zone" value={timezone} onPress={() => setTimezoneModalVisible(true)} />

            <View style={styles.sectionDivider} />

            <RowLabel label="Invitees" value={invitees.length ? `${invitees.length} invited` : 'None'} onPress={() => setInviteModalVisible(true)} />

            <View style={styles.pmiRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Use personal meeting ID (PMI)</Text>
                <Text style={styles.rowValueSmall}>{personalMeetingId}</Text>
              </View>
              <Switch value={usePMI} onValueChange={setUsePMI} />
            </View>

            <View style={styles.sectionDivider} />

            <Text style={styles.sectionTitle}>Security</Text>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Require meeting passcode</Text>
                <Text style={styles.rowValueSmall}>Only users who have the invite link or passcode can join the meeting</Text>
              </View>
              <Switch value={requirePasscode} onValueChange={toggleRequirePasscode} />
            </View>

            {requirePasscode && (
              <View style={styles.passcodeRow}>
                <TextInput
                  style={styles.passcodeInput}
                  value={passcode}
                  onChangeText={setPasscode}
                  placeholder="Passcode"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            )}

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Enable waiting room</Text>
                <Text style={styles.rowValueSmall}>Only users admitted by the host can join the meeting</Text>
              </View>
              <Switch value={enableWaitingRoom} onValueChange={setEnableWaitingRoom} />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Only allow authenticated users</Text>
                <Text style={styles.rowValueSmall}>Require users to sign in to join</Text>
              </View>
              <Switch value={onlyAuthenticatedUsers} onValueChange={setOnlyAuthenticatedUsers} />
            </View>

            <View style={styles.sectionDivider} />

            <Text style={styles.sectionTitle}>Meeting chat</Text>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Continuous meeting chat</Text>
                <Text style={styles.rowValueSmall}>Chat will continue before and after the meeting</Text>
              </View>
              <Switch value={continuousChat} onValueChange={setContinuousChat} />
            </View>

            <View style={styles.sectionDivider} />

            <Text style={styles.sectionTitle}>Meeting options</Text>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Host video on</Text>
              </View>
              <Switch value={hostVideo} onValueChange={setHostVideo} />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Participant video on</Text>
              </View>
              <Switch value={participantVideo} onValueChange={setParticipantVideo} />
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.footerRow}>
              <Text style={styles.addToCalendarLabel}>Add to calendar</Text>
              <Switch value={addToCalendar} onValueChange={setAddToCalendar} />
            </View>
          </View>
        </ScrollView>

        {/* DateTimePicker controls */}
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
            onChange={onDateChange}
          />
        )}

        {showFromPicker && (
          <DateTimePicker
            value={fromTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
            onChange={onFromChange}
            is24Hour={false}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={toTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
            onChange={onToChange}
            is24Hour={false}
          />
        )}

        {/* Invitees modal */}
        <Modal visible={inviteModalVisible} animationType="slide" onRequestClose={() => setInviteModalVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#081018' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Text style={styles.modalHeaderAction}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Invite people</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Text style={styles.modalHeaderAction}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>Add invitee (email or name)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  placeholder="e.g. alice@example.com"
                  placeholderTextColor="#94a3b8"
                  value={inviteeInput}
                  onChangeText={setInviteeInput}
                  style={styles.inviteInput}
                />
                <TouchableOpacity style={styles.addInviteBtn} onPress={addInvitee}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Current invitees</Text>

              {invitees.length === 0 ? (
                <Text style={{ color: '#94a3b8', marginTop: 12 }}>No invitees yet.</Text>
              ) : (
                <FlatList
                  data={invitees}
                  keyExtractor={(_, idx) => String(idx)}
                  style={{ marginTop: 8 }}
                  renderItem={({ item, index }) => (
                    <View style={styles.inviteeRow}>
                      <Text style={{ color: '#e6eef8' }}>{item}</Text>
                      <TouchableOpacity onPress={() => removeInvitee(index)}>
                        <Text style={{ color: '#ff6b6b', fontWeight: '700' }}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          </SafeAreaView>
        </Modal>

        {/* Repeat modal (radio) */}
        <Modal visible={repeatModalVisible} animationType="slide" onRequestClose={() => setRepeatModalVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#081018' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setRepeatModalVisible(false)}>
                <Text style={styles.modalHeaderAction}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Repeat</Text>
              <TouchableOpacity onPress={() => setRepeatModalVisible(false)}>
                <Text style={styles.modalHeaderAction}>Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={REPEAT_OPTIONS}
              keyExtractor={(i) => i}
              renderItem={({ item }) => {
                const selected = item === repeatOption;
                return (
                  <Pressable
                    onPress={() => setRepeatOption(item)}
                    style={[styles.radioRow, selected && { backgroundColor: '#0f1724' }]}
                  >
                    <View>
                      <Text style={[styles.rowTitle, { fontSize: 16 }]}>{item}</Text>
                    </View>
                    <View style={styles.radioCircleOuter}>
                      {selected ? <View style={styles.radioCircleInner} /> : null}
                    </View>
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#0b1220' }} />}
            />
          </SafeAreaView>
        </Modal>

        {/* Time zone modal */}
        <Modal visible={timezoneModalVisible} animationType="slide" onRequestClose={() => setTimezoneModalVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#081018' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setTimezoneModalVisible(false)}>
                <Text style={styles.modalHeaderAction}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Select time zone</Text>
              <View style={{ width: 60 }} />
            </View>

            <FlatList
              data={TIMEZONES}
              keyExtractor={(t) => t}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setTimezone(item);
                    setTimezoneModalVisible(false);
                  }}
                  style={styles.timezoneRow}
                >
                  <View>
                    <Text style={styles.rowTitle}>{item.split(' ').slice(1).join(' ')}</Text>
                    <Text style={styles.rowValueSmall}>{item.split(' ')[0]}</Text>
                  </View>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#0b1220' }} />}
            />
          </SafeAreaView>
        </Modal>

        {/* Topic edit modal */}
        <Modal visible={editModalVisible} animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#081018' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalHeaderAction}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Edit topic</Text>
              <TouchableOpacity
                onPress={() => {
                  saveEditTopic();
                }}
              >
                <Text style={styles.modalHeaderAction}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>Meeting topic</Text>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                style={styles.inviteInput}
                placeholder="Meeting topic"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* Utility */
function generatePasscode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/* Styles */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b1220',
  },
  headerAction: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  container: {
    padding: 16,
    paddingBottom: 48,
  },
  infoBanner: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#0f1724',
    borderRadius: 10,
    padding: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowTitle: {
    color: '#e6eef8',
    fontSize: 15,
    fontWeight: '600',
  },
  rowValue: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  rowValueSmall: {
    color: '#9fb0c9',
    fontSize: 12,
    marginTop: 2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#0b1220',
    marginVertical: 6,
  },
  pmiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  passcodeRow: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  passcodeInput: {
    backgroundColor: '#0b1220',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#fff',
    fontWeight: '600',
    alignSelf: 'flex-start',
    minWidth: 140,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  addToCalendarLabel: {
    color: '#e6eef8',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Invite modal */
  modalHeader: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: '#081018',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderAction: {
    color: '#60a5fa',
    fontWeight: '600',
    fontSize: 16,
  },
  modalHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
    flex: 1,
    backgroundColor: '#081018',
  },
  modalLabel: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  inviteInput: {
    backgroundColor: '#0b1220',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    flex: 1,
  },
  addInviteBtn: {
    backgroundColor: '#2b7cf0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 8,
    borderRadius: 8,
  },
  inviteeRow: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f1724',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  /* Repeat radio list */
  radioRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radioCircleOuter: {
    height: 22,
    width: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleInner: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: '#2b7cf0',
  },

  timezoneRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});

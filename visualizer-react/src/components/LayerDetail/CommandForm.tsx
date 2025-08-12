import {useState} from 'react';
import {Button, Tooltip, Switch, Autocomplete, AutocompleteItem, Input, Select, SelectItem} from '@heroui/react';
import { overlayMotion } from '../../ui/motion';
import {Modal} from '../Modals/Modal';
import {useCommandForm, type CmdType} from '../../hooks/useCommandForm';
import {useAISuggestions} from '../../hooks/useAISuggestions';
import {windowCommandItems} from '../../data/windowCommands';
import {labelForKey} from '../../utils/keys';
import {AppCommandForm} from './CommandTypes/AppCommandForm';
import {WindowCommandForm} from './CommandTypes/WindowCommandForm';

export function CommandForm(props: {
  onCancel: () => void;
  onSave: (v: { type: CmdType; text: string; ignore?: boolean; innerKey: string }) => void;
  takenKeys: string[];
  initial?: { type: CmdType; text: string; ignore?: boolean; innerKey?: string };
  mode: 'add' | 'edit';
  onDelete?: () => void;
  isKeyLevel?: boolean;
  isBlocked?: boolean;
  baseKey?: string | null;
}) {
  const {onCancel, onSave, takenKeys, initial, mode, onDelete, isKeyLevel, isBlocked, baseKey} = props;

  const {
    type, setType,
    text, setText,
    ignore, setIgnore,
    innerKey, setInnerKey,
    keyOptions,
    appItems,
    windowQuery, setWindowQuery, getWindowLabel,
    isRecording, setIsRecording, keyPress, setKeyPress, recordedLabel,
    isAIMode, canSave,
  } = useCommandForm({ initial, takenKeys, mode, isKeyLevel });

  const {
    hasAIKey,
    apiKeyInput, setApiKeyInput,
    showApiKeyModal, setShowApiKeyModal,
    setAIKey,
    isSuggesting,
    suggestedKey, setSuggestedKey,
    rationale, setRationale,
    runSuggestion,
  } = useAISuggestions();

  const [confirmDeleteCmdOpen, setConfirmDeleteCmdOpen] = useState(false);

  const typeOptions: CmdType[] = ['app', 'window', 'raycast', 'key', 'shell'];
  const disabledTypes = new Set<CmdType>(['shell']);
  const typeDescriptions: Partial<Record<CmdType, string>> = { shell: 'Coming soon' };
  const canSaveEffective = canSave && !isBlocked;

  type KeyOption = { id: string; label: string; disabled?: boolean };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{mode === 'edit' ? 'Edit Command' : (isAIMode ? 'Add with AI' : 'Add Command')}</h3>
        <div className="flex items-center gap-2 text-xs text-default-600">
          {!isKeyLevel && baseKey && (
            <span className="inline-flex items-center gap-1 rounded bg-default-200 px-1.5 py-0.5"><span className="text-default-500">Sublayer</span><span className="font-medium">{labelForKey(baseKey)}</span></span>
          )}
          {!isKeyLevel && (innerKey || initial?.innerKey) && (
            <span className="inline-flex items-center gap-1 rounded bg-default-200 px-1.5 py-0.5"><span className="text-default-500">Key</span><span className="font-medium">{labelForKey(innerKey || initial?.innerKey || '')}</span></span>
          )}
          {isKeyLevel && baseKey && (
            <span className="inline-flex items-center gap-1 rounded bg-default-200 px-1.5 py-0.5"><span className="text-default-500">Key</span><span className="font-medium">{labelForKey(baseKey)}</span></span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <Select
          label="Type"
          selectedKeys={new Set([type])}
          onSelectionChange={(keys) => {
            const v = Array.from(keys as Set<string>)[0] as CmdType | undefined;
            if (v) setType(v);
          }}
        >
          {typeOptions.map((t) => (
            <SelectItem key={t} isDisabled={disabledTypes.has(t)} description={typeDescriptions[t]}>
              {t}
            </SelectItem>
          ))}
        </Select>

        {type === 'app' ? (
          <AppCommandForm items={appItems} text={text} setText={setText} />
        ) : type === 'window' ? (
          <WindowCommandForm
            items={windowCommandItems}
            query={windowQuery}
            setQuery={setWindowQuery}
            setText={setText}
            getLabel={getWindowLabel}
          />
        ) : (
          type === 'raycast' ? (
            <Input label="Raycast deeplink" placeholder="Paste Raycast deeplink (raycast://…)" value={text} onChange={(e) => setText(e.target.value)} />
          ) : (
            type !== 'key' && (
              <Input label="Text" placeholder="e.g. Safari" value={text} onChange={(e) => setText(e.target.value)} />
            )
          )
        )}

        {type === 'key' && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="solid" color={isRecording ? 'danger' : 'secondary'} onPress={() => setIsRecording(r => !r)}>
              {isRecording ? 'Stop' : 'Record'}
            </Button>
            <div className="text-sm text-default-600 min-h-6">
              {recordedLabel || (isRecording ? 'Press a key combo…' : 'No key captured')}
            </div>
            {keyPress.key_code && (
              <Button size="sm" variant="flat" onPress={() => { setKeyPress({}); setText(''); }}>Clear</Button>
            )}
          </div>
        )}

        {isAIMode && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-default-500">
              {hasAIKey ? 'Gemini suggestions enabled' : 'Gemini suggestions disabled'}
            </div>
            <Button size="sm" variant="flat" onPress={() => { setApiKeyInput(''); setShowApiKeyModal(true); }}>
              {hasAIKey ? 'Update API key' : 'Set API key'}
            </Button>
          </div>
        )}

        {type === 'raycast' && (
          <Tooltip content={"If enabled, uses 'open -g' so Raycast opens in the background and doesn't take focus"} placement="right" motionProps={overlayMotion}>
            <Switch isSelected={ignore} onValueChange={setIgnore}>
              Open in background
            </Switch>
          </Tooltip>
        )}

        {!isKeyLevel && (
          !isAIMode ? (
            <Autocomplete
              label="Key in this sublayer"
              labelPlacement="outside"
              placeholder={`Choose a key${takenKeys.length ? ` — taken: ${takenKeys.join(',')}` : ''}`}
              defaultItems={keyOptions}
              allowsCustomValue={false}
              radius="sm"
              size="lg"
              isVirtualized
              itemHeight={36}
              maxListboxHeight={320}
              isClearable={false}
              inputValue={innerKey}
              onInputChange={(val) => setInnerKey((val || '').toLowerCase())}
              onSelectionChange={(key) => setInnerKey(String(key || ''))}
              classNames={{
                base: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0',
                listbox: 'outline-none',
                listboxWrapper: 'outline-none ring-0 border-0',
                popoverContent: 'outline-none border-0 ring-0',
                endContentWrapper: 'hidden',
                clearButton: 'hidden',
                selectorButton: 'hidden',
              }}
              popoverProps={{
                offset: 8,
                motionProps: overlayMotion,
                classNames: {
                  base: 'rounded-medium',
                  content: 'p-1 border-0 bg-background',
                },
              }}
              listboxProps={{
                topContent: (
                  <div className="px-2 py-1 text-[11px] leading-none text-default-500">
                    Keys in sublayer
                  </div>
                ),
                hideSelectedIcon: true,
                itemClasses: {
                  base: 'rounded-small outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-none px-2.5 py-1.5 data-[hover=true]:bg-default-100 data-[focus=true]:bg-default-100 data-[selected=true]:bg-default-200 data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-0',
                  wrapper: 'outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 ring-offset-0 border-transparent',
                  selectedIcon: 'hidden',
                },
              }}
            >
              {(item: KeyOption) => (
                <AutocompleteItem
                  key={item.id}
                  isDisabled={item.disabled}
                  description={item.disabled ? 'Already taken' : undefined}
                >
                  {item.label}
                </AutocompleteItem>
              )}
            </Autocomplete>
          ) : (
            <div className="text-sm text-default-600">
              {suggestedKey ? (
                <div>
                  Suggested key in sublayer: <span className="font-semibold">{labelForKey(suggestedKey)}</span>
                  {rationale && <div className="mt-1 text-default-500">{rationale}</div>}
                </div>
              ) : (
                <div>Click Suggest to propose a key in this sublayer based on your command name and availability.</div>
              )}
            </div>
          )
        )}
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Tooltip content="Close without saving" placement="top" motionProps={overlayMotion}>
          <Button variant="solid" color="default" className="text-black" onPress={onCancel}>Cancel</Button>
        </Tooltip>
        {mode === 'edit' && onDelete && (
          <Tooltip content="Delete this command" placement="top" motionProps={overlayMotion}>
            <Button variant="solid" color="danger" onPress={() => setConfirmDeleteCmdOpen(true)}>Delete</Button>
          </Tooltip>
        )}
        {!isAIMode ? (
          <Tooltip content="Save command" placement="top" motionProps={overlayMotion}>
            <Button variant="solid" color="primary" isDisabled={!canSaveEffective} onPress={() => onSave({ type, text, ignore, innerKey })}>Save</Button>
          </Tooltip>
        ) : suggestedKey ? (
          <Tooltip content="Save command" placement="top" motionProps={overlayMotion}>
            <Button variant="solid" color="primary" isDisabled={!canSaveEffective} onPress={() => onSave({ type, text, ignore, innerKey: suggestedKey })}>Save</Button>
          </Tooltip>
        ) : (
          <Tooltip content={hasAIKey ? 'Suggest a key in this sublayer' : 'Add your Gemini API key to enable suggestions'} placement="top" motionProps={overlayMotion}>
            <span className="inline-block">
              <Button
                variant="solid"
                color="primary"
                isDisabled={!hasAIKey || !text.trim()}
                isLoading={isSuggesting}
                onPress={async () => {
                  const {key, reason} = runSuggestion({ type, text, takenInnerKeys: takenKeys.map(k => k.toLowerCase()) });
                  setSuggestedKey(key || '');
                  setRationale(reason || '');
                  if (key) setInnerKey(key);
                }}
              >
                Suggest
              </Button>
            </span>
          </Tooltip>
        )}
      </div>

      {/* API key modal */}
      <Modal open={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} isDismissable size="sm">
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Gemini API key</h3>
          <Input
            type="password"
            label="API key"
            placeholder="Paste your Gemini API key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="solid" color="default" className="text-black" onPress={() => setShowApiKeyModal(false)}>Cancel</Button>
            <Button variant="solid" color="primary" onPress={() => { setAIKey(apiKeyInput.trim()); setShowApiKeyModal(false); }}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete inner command */}
      <Modal open={!!confirmDeleteCmdOpen} onClose={() => setConfirmDeleteCmdOpen(false)} isDismissable size="sm">
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Delete Command?</h3>
          <p className="text-sm text-default-600">This will remove the command for key <span className="font-semibold">{labelForKey(innerKey || initial?.innerKey || '')}</span>{baseKey ? <> in sublayer <span className="font-semibold">{labelForKey(baseKey)}</span></> : null}. This action cannot be undone.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="solid" color="default" className="text-black" onPress={() => setConfirmDeleteCmdOpen(false)} autoFocus>Cancel</Button>
            <Button variant="solid" color="danger" onPress={() => { onDelete?.(); setConfirmDeleteCmdOpen(false); }}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

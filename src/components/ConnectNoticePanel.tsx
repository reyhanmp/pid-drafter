/**
 * Refusal notice for a blocked connection (PRD §7a items 1+2).
 *
 * The one-connection-per-nozzle rule is enforced during the drag, which means
 * the user's experience of it is a gesture that does not take. That alone is
 * not enough: a connection that silently fails is indistinguishable from a
 * broken drag, and the honest signal for "this is physically impossible" is a
 * sentence naming the nozzle, plus the one action that makes the connection
 * legal again.
 *
 * So this panel does two things and the second is the point: it explains, and
 * when the equipment still has a free nozzle it OFFERS to drop a branch fitting
 * there. Without that offer the rule would leave a user unable to draw a header
 * with branches at all — the ordinary arrangement the rule exists to make
 * drawable — which would be a worse tool than the one with the hole in it.
 *
 * Deliberately a dismissible strip rather than a modal: the user is mid-drag
 * mindset, and a modal would steal the grid they just tried to connect on.
 */
export interface ConnectNotice {
  message: string;
  /** Present when the blocked equipment has a free nozzle a tee could go on. */
  tee?: {
    nodeId: string;
    portId: string;
    nodeLabel: string;
    portLabel: string;
  };
}

export default function ConnectNoticePanel({
  notice,
  onPlaceTee,
  onDismiss,
}: {
  notice: ConnectNotice;
  onPlaceTee: (tee: NonNullable<ConnectNotice['tee']>) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="connect-notice" data-testid="connect-notice" role="status">
      <span className="connect-notice-icon" aria-hidden="true">
        !
      </span>
      <span className="connect-notice-message" data-testid="connect-notice-message">
        {notice.message}
      </span>
      {notice.tee && (
        <button
          type="button"
          className="connect-notice-action"
          data-testid="connect-notice-place-tee"
          onClick={() => onPlaceTee(notice.tee!)}
        >
          Place tee on {notice.tee.portLabel}
        </button>
      )}
      <button type="button" className="connect-notice-dismiss" data-testid="connect-notice-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

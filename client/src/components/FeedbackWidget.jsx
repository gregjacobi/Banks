import React, { useState } from 'react';
import { Star, Send, ThumbsUp, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

/**
 * FeedbackWidget - Collects user feedback on reports and podcasts
 */
const FeedbackWidget = ({
  feedbackType, // 'report' or 'podcast'
  bankIdrssd,
  bankName,
  reportTimestamp,
  reportingPeriod,
  podcastExperts = [],
  onSubmitSuccess
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' or 'error'

  // Tag options
  const positiveTags = [
    { value: 'accurate', label: 'Accurate' },
    { value: 'insightful', label: 'Insightful' },
    { value: 'actionable', label: 'Actionable' },
    { value: 'well_structured', label: 'Well Structured' },
    { value: 'helpful_discovery_questions', label: 'Helpful Discovery Questions' },
    { value: 'good_business_context', label: 'Good Business Context' }
  ];

  const negativeTags = [
    { value: 'inaccurate', label: 'Inaccurate' },
    { value: 'missing_context', label: 'Missing Context' },
    { value: 'too_technical', label: 'Too Technical' },
    { value: 'too_basic', label: 'Too Basic' },
    { value: 'confusing', label: 'Confusing' },
    { value: 'wrong_interpretation', label: 'Wrong Interpretation' }
  ];

  const podcastTags = [
    { value: 'natural_conversation', label: 'Natural Conversation' },
    { value: 'good_pacing', label: 'Good Pacing' },
    { value: 'too_long', label: 'Too Long' },
    { value: 'too_short', label: 'Too Short' },
    { value: 'helpful_for_ae_prep', label: 'Helpful for AE Prep' }
  ];

  const allTags = feedbackType === 'podcast'
    ? [...positiveTags, ...negativeTags, ...podcastTags]
    : [...positiveTags, ...negativeTags];

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch('http://localhost:5001/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType,
          bankIdrssd,
          bankName,
          reportTimestamp,
          reportingPeriod,
          podcastExperts: feedbackType === 'podcast' ? podcastExperts : undefined,
          rating,
          comment,
          tags: selectedTags,
          userId: 'anonymous' // Can be extended for user auth
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        // Reset form after 2 seconds
        setTimeout(() => {
          setRating(0);
          setComment('');
          setSelectedTags([]);
          setIsOpen(false);
          setSubmitStatus(null);
          if (onSubmitSuccess) onSubmitSuccess();
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="text-xs"
        >
          <ThumbsUp className="w-3 h-3 mr-1" />
          Rate this {feedbackType}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Help us improve</CardTitle>
            <CardDescription className="text-xs">
              Your feedback helps us create better {feedbackType}s
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Star Rating */}
        <div>
          <label className="text-sm font-medium mb-2 block">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= (hoveredRating || rating)
                      ? 'fill-primary text-primary'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-gray-600">
                {rating === 5 ? 'Excellent!' : rating === 4 ? 'Good' : rating === 3 ? 'Fair' : rating === 2 ? 'Poor' : 'Very Poor'}
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium mb-2 block">What stood out? (optional)</label>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggleTag(tag.value)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  selectedTags.includes(tag.value)
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="text-sm font-medium mb-2 block">Additional comments (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What could be improved? What did you find most helpful?"
            className="w-full px-3 py-2 border rounded-md text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={2000}
          />
          <div className="text-xs text-gray-500 mt-1">
            {comment.length}/2000 characters
          </div>
        </div>

        {/* Submit Status */}
        {submitStatus === 'success' && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <ThumbsUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800">Thank you for your feedback!</span>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-800">Failed to submit feedback. Please try again.</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="flex-1"
          >
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeedbackWidget;
